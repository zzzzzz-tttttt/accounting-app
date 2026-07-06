// 读取用户自己设置的 API Key（存在浏览器本地）
export function getUserApiKey() {
  return localStorage.getItem('user_api_key') || ''
}

export function setUserApiKey(key) {
  localStorage.setItem('user_api_key', key.trim())
}

export function hasUserApiKey() {
  return !!getUserApiKey()
}
