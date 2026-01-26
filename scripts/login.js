
// scripts/login.js
'use strict';

/**
 * ログイン成功/失敗時の遷移先
 * - 相対パスでも絶対URL（https://...）でも可
 */
const URL_SUCCESS = 'https://xhquemdkiwvakjq.web.app/Vuetify3.html';                    // ← A：成功時の遷移先（例：トップ/チャット画面）
const URL_FAILED  = 'https://vuetifyjs.com/ja/getting-started/installation/';  // ← B：失敗時の遷移先（例：ログイン画面＋エラー）

function EasyChat() {
  this.checkSetup();

  // DOM
  this.form    = document.getElementById('email-login-form');
  this.emailEl = document.getElementById('email');
  this.passEl  = document.getElementById('password');
  this.msgEl   = document.getElementById('message');
  this.resetEl = document.getElementById('reset-link');

  // Firebase 初期化
  this.initFirebase();

  // イベント登録
  if (this.form)   this.form.addEventListener('submit', this.handleSubmit.bind(this));
  if (this.resetEl) this.resetEl.addEventListener('click', this.handleReset.bind(this));
}

/** Firebase 初期化 */
EasyChat.prototype.initFirebase = function () {
  // Hosting の /__/firebase/init.js により initializeApp 済み
  this.auth = firebase.auth();

  // ブラウザ/タブを閉じたらログアウトにする（必要なければコメントアウト）
  this.auth.setPersistence(firebase.auth.Auth.Persistence.SESSION)
    .catch((e) => console.warn('setPersistence error:', e));

  // 既ログイン（成功）状態なら A に遷移
  this.unsubscribe = this.auth.onAuthStateChanged(this.onAuthStateChanged.bind(this));
};

/** すでにログインしている場合：成功扱いで A へ */
EasyChat.prototype.onAuthStateChanged = function (user) {
  if (user) {
    // displayName が空なら email で上書き（初回のみ）
    if (!user.displayName && user.email) {
      user.updateProfile({ displayName: user.email }).catch((e) => console.warn('updateProfile:', e));
    }
    // 成功 → A に遷移
    window.location.href = URL_SUCCESS;
  }
};

/** フォーム送信（メール＋パスワードでサインイン） */
EasyChat.prototype.handleSubmit = async function (e) {
  e.preventDefault();
  this.msg('');

  const email = (this.emailEl?.value || '').trim();
  const password = this.passEl?.value || '';

  if (!email || !password) {
    return this.msg('メールとパスワードを入力してください。');
  }

  // MDL のエラースタイルをリセット
  this.markField(this.emailEl, false);
  this.markField(this.passEl, false);

  try {
    const cred = await this.auth.signInWithEmailAndPassword(email, password);

    // 初回は displayName を email で統一
    if (cred?.user && !cred.user.displayName && cred.user.email) {
      await cred.user.updateProfile({ displayName: cred.user.email }).catch(() => {});
    }

    // 成功 → A
    window.location.href = URL_SUCCESS;

  } catch (err) {
    console.error(err);

    // フィールド単位のエラー表示（UI用）
    const code = String(err?.code || '');
    switch (code) {
      case 'auth/invalid-email':
        this.markField(this.emailEl, true);
        this.msg('メールアドレスの形式が正しくありません。');
