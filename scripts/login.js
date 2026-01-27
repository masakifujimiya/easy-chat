
// scripts/login.js
'use strict';

/**
 * ログイン成功/失敗時の遷移先
 * - 相対パスでも絶対URL（https://...）でも可
 */
const URL_SUCCESS = 'https://xhquemdkiwvakjq.web.app/Vuetify3.html';            // A：成功時
const URL_FAILED  = 'https://vuetifyjs.com/ja/getting-started/installation/';   // B：失敗時

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

  // ブラウザ/タブを閉じたらログアウト（要件に応じて NONE/LOCAL へ変更可）
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
    window.location.replace(URL_SUCCESS); // 戻るで戻らせたくない場合は replace が便利
  }
};

/** フォーム送信（メール＋パスワードでサインイン） */
EasyChat.prototype.handleSubmit = async function (e) {
  e.preventDefault();
  this.msg('');

  const email = (this.emailEl?.value || '').trim();
  const password = this.passEl?.value || '';

  if (!email || !password) {
    this.msg('入力してください。');
    return;
  }

  // MDL のエラースタイルをリセット
  this.markField(this.emailEl, false);
  this.markField(this.passEl, false);

  try {
    const cred = await this.auth.signInWithEmailAndPassword(email, password);

    // 初回は displayName を email で統一
    if (cred?.user && !cred.user.displayName && cred.user.email) {
      try { await cred.user.updateProfile({ displayName: cred.user.email }); } catch {}
    }

    // 成功 → A
    window.location.replace(URL_SUCCESS);

  } catch (err) {
    console.error('signIn error:', err);

    // フィールド単位のエラー表示（UI用）
    const code = String(err?.code || '');
    switch (code) {
      default:
        this.msg('時間をおいて再試行してください。');
        break;
    }

    // 失敗 → B に遷移（UIメッセージが見えるよう少し待つ）
    setTimeout(() => {
      // 戻るでフォームに戻したい場合は href、戻させたくない場合は replace
      window.location.href = URL_FAILED;
      // window.location.replace(URL_FAILED);
    }, 400);
  }
};

/** パスワード再設定メール送信 */
EasyChat.prototype.handleReset = async function (e) {
  e.preventDefault();
  this.msg('');
  const email = (this.emailEl?.value || '').trim();
  if (!email) return this.msg('再設定するメールアドレスを入力してください。');

  try {
    await this.auth.sendPasswordResetEmail(email);
    this.msg('パスワード再設定用のメールを送信しました。', true);
  } catch (err) {
    console.error(err);
    this.msg('再設定メールの送信に失敗しました。メールアドレスをご確認ください。');
  }
};

/** メッセージ表示（UI） */
EasyChat.prototype.msg = function (text, success) {
  if (!this.msgEl) return;
  this.msgEl.textContent = text || '';
  if (success) this.msgEl.classList.add('success');
  else this.msgEl.classList.remove('success');
};

/** MDL のエラースタイル切り替え */
EasyChat.prototype.markField = function (inputEl, isError) {
  if (!inputEl) return;
  const wrapper = inputEl.closest('.mdl-textfield');
  if (!wrapper) return;
  if (isError) wrapper.classList.add('is-invalid');
  else wrapper.classList.remove('is-invalid');
};

/** SDK 準備チェック */
EasyChat.prototype.checkSetup = function () {
  if (!window.firebase || !(firebase.app instanceof Function) || !firebase.app().options) {
    window.alert(
      'Firebase SDK が正しく設定されていません。' +
      'Firebase Hosting で /__/firebase/init.js が読み込まれているか確認してください。'
    );
  }
};

window.onload = function () {
  window.easyChat = new EasyChat();
};
``
