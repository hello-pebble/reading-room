// 서버 연결: 주소 끝에 ?api=http://localhost:8080 을 붙여 한 번 열면 서버 주소가 저장되고(?api= 로 비우면 지워진다),
// 서버 연결 모드가 된다. 주소가 없으면 API.enabled가 false이고 화면은 프로토타입(localStorage)대로만 동작한다.
// 로그인 토큰(Bearer)은 localStorage의 myroom-token에 둔다. 서버가 401을 주면 토큰을 지우고 API.onUnauthorized를 부른다.
const API = (() => {
  const KEY_BASE = 'myroom-api',
    KEY_TOKEN = 'myroom-token';
  const ls = {
    get(k) {
      try {
        return localStorage.getItem(k);
      } catch (e) {
        return null;
      }
    },
    set(k, v) {
      try {
        if (v == null) localStorage.removeItem(k);
        else localStorage.setItem(k, v);
      } catch (e) {}
    },
  };
  try {
    const q = new URLSearchParams(location.search);
    if (q.has('api')) {
      const v = q.get('api').trim().replace(/\/+$/, '');
      if (/^https?:\/\//.test(v)) ls.set(KEY_BASE, v);
      else if (v === '') ls.set(KEY_BASE, null);
    }
  } catch (e) {}
  const base = ls.get(KEY_BASE);

  // status 0은 서버에 닿지 못한 경우(NETWORK). code·message는 서버가 준 값 그대로다.
  class ApiError extends Error {
    constructor(status, code, message) {
      super(message);
      this.status = status;
      this.code = code;
    }
  }

  async function request(method, path, body) {
    const headers = {};
    const token = ls.get(KEY_TOKEN);
    if (token) headers.Authorization = 'Bearer ' + token;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    let res;
    try {
      res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch (e) {
      throw new ApiError(0, 'NETWORK', '서버에 연결할 수 없어요');
    }
    if (res.status === 204) return null;
    let data = null;
    try {
      data = await res.json();
    } catch (e) {}
    if (res.status === 401 && token) {
      ls.set(KEY_TOKEN, null);
      if (api.onUnauthorized) api.onUnauthorized();
    }
    if (!res.ok)
      throw new ApiError(
        res.status,
        (data && data.error) || 'ERROR',
        (data && data.message) || '요청을 처리하지 못했어요',
      );
    return data;
  }

  const api = {
    ApiError,
    request,
    onUnauthorized: null,
    get enabled() {
      return !!base;
    },
    get base() {
      return base;
    },
    get token() {
      return ls.get(KEY_TOKEN);
    },
    setToken(t) {
      ls.set(KEY_TOKEN, t);
    },
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body === undefined ? {} : body),
    put: (path, body) => request('PUT', path, body),
  };
  return api;
})();
