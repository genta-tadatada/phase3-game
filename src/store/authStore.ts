// ============================================================
// store/authStore.ts — アカウント状態（Zustand）
// loading → guest / needsNickname / member の状態機械。
// phase1-tools/components/shared/AuthProvider.tsx の設計を移植（Context→zustand）。
//
// - 起動時に一度 /api/auth/me を確認する。ローカルdev等で失敗したら「未ログイン」に静かに縮退。
// - member になった瞬間にクラウドセーブ同期（lib/cloudSave.ts）を起動する。
// - ニックネーム以外のユーザー識別子は保持しない（サーバが返すのは loggedIn / nickname のみ）。
// - ログインは任意。未ログインでも全機能そのまま遊べる（同期だけの付加価値）。
// ============================================================

import { create } from 'zustand'
import { clearSyncState, onLoginSync, pushIfChanged, startAutoPush } from '../lib/cloudSave'

export type AuthStatus = 'loading' | 'guest' | 'needsNickname' | 'member'

/** onLoginSync が conflict を返したときの選択肢（UIがモーダルでユーザーに選ばせる） */
export interface SyncConflict {
  /** クラウドの（より新しい）データを取り込む。localStorageへ書き戻したあとリロードが走る */
  importRemote: () => void
  /** この端末のデータでクラウドを上書きする */
  keepLocal: () => Promise<void>
}

interface AuthState {
  status: AuthStatus
  nickname: string | null
  /** 非null＝「別端末により新しいセーブがある」確認待ち。UIは最前面モーダルで選ばせる */
  conflict: SyncConflict | null
  /** 通信中（ボタン連打防止用） */
  busy: boolean
  /** 起動時に1回だけ呼ぶ。/api/auth/me で状態を確定する（多重呼び出しは無視） */
  init: () => Promise<void>
  /** Googleログイン開始（302リダイレクト方式・fetchではない） */
  login: () => void
  /** ニックネーム設定。成功で member へ。失敗（400等）は false を返す */
  setNickname: (name: string) => Promise<boolean>
  logout: () => Promise<void>
  /** アカウントとクラウドセーブを即時削除（ローカルセーブは残る） */
  deleteAccount: () => Promise<void>
  resolveConflict: (choice: 'import' | 'keepLocal') => void
}

// モジュールスコープの制御フラグ（StrictModeの二重実行・多重初期化の防止）
let initStarted = false
let memberEntered = false
let stopAutoPush: (() => void) | null = null

/** /api/auth/me の確認。未ログイン・ネット失敗・ローカルdevは null（=guest扱い） */
async function fetchMe(): Promise<{ nickname: string | null } | null> {
  try {
    const r = await fetch('/api/auth/me', { credentials: 'include' })
    if (!r.ok) return null // 401含む
    const j: unknown = await r.json()
    if (typeof j !== 'object' || j === null) return null
    const { loggedIn, nickname } = j as { loggedIn?: unknown; nickname?: unknown }
    if (loggedIn !== true) return null
    return { nickname: typeof nickname === 'string' && nickname.length > 0 ? nickname : null }
  } catch {
    return null
  }
}

/** 状態変更API（Origin検査あり）。失敗は null（呼び側で静かに処理） */
async function post(path: string, body?: unknown): Promise<Response | null> {
  try {
    return await fetch(path, {
      method: 'POST',
      credentials: 'include',
      ...(body !== undefined
        ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
        : {}),
    })
  } catch {
    return null
  }
}

export const useAuth = create<AuthState>((set, get) => ({
  status: 'loading',
  nickname: null,
  conflict: null,
  busy: false,

  init: async () => {
    if (initStarted) return
    initStarted = true
    const me = await fetchMe()
    if (!me) {
      set({ status: 'guest', nickname: null })
      return
    }
    if (me.nickname === null) {
      set({ status: 'needsNickname', nickname: null })
      return
    }
    set({ status: 'member', nickname: me.nickname })
    await enterMemberSync()
  },

  login: () => {
    window.location.href = '/api/auth/login?return_to=/games/football/'
  },

  setNickname: async (name) => {
    const trimmed = name.trim()
    if (trimmed.length < 1 || trimmed.length > 20 || get().busy) return false
    set({ busy: true })
    const r = await post('/api/auth/nickname', { nickname: trimmed })
    if (!r || !r.ok) {
      set({ busy: false })
      return false
    }
    const j = (await r.json().catch(() => null)) as { nickname?: unknown } | null
    const saved = typeof j?.nickname === 'string' ? j.nickname : trimmed
    set({ status: 'member', nickname: saved, busy: false })
    void enterMemberSync() // 初回member入場のみ実行（変更時はフラグでno-op）
    return true
  },

  logout: async () => {
    if (get().busy) return
    set({ busy: true })
    // 最新のローカルデータを最善努力でクラウドに残してからログアウトする（失敗しても続行）
    await pushIfChanged()
    const r = await post('/api/auth/logout')
    if (!r || !r.ok) {
      // ログアウトできていないのに「ログアウト済み」を装わない（再試行可能なまま戻す）
      set({ busy: false })
      return
    }
    leaveMember()
  },

  deleteAccount: async () => {
    if (get().busy) return
    set({ busy: true })
    const r = await post('/api/auth/delete')
    if (!r || !r.ok) {
      set({ busy: false })
      return
    }
    leaveMember()
  },

  resolveConflict: (choice) => {
    const conflict = get().conflict
    if (!conflict) return
    set({ conflict: null })
    if (choice === 'import') {
      conflict.importRemote() // localStorageへ書き戻し→リロードが走る
    } else {
      void conflict.keepLocal()
    }
  },
}))

/** member 入場処理（自動プッシュ開始＋ログイン時同期）。1ログインにつき1回だけ */
async function enterMemberSync(): Promise<void> {
  if (memberEntered) return
  memberEntered = true
  stopAutoPush = startAutoPush()
  const outcome = await onLoginSync()
  if (outcome.kind === 'conflict') {
    useAuth.setState({
      conflict: { importRemote: outcome.importRemote, keepLocal: outcome.keepLocal },
    })
  }
}

/** member 退場処理（ログアウト・アカウント削除の共通後始末）。ローカルセーブ本体には触れない */
function leaveMember(): void {
  if (stopAutoPush) {
    stopAutoPush()
    stopAutoPush = null
  }
  memberEntered = false
  clearSyncState()
  useAuth.setState({ status: 'guest', nickname: null, conflict: null, busy: false })
}
