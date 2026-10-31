function validateApiOrigin(value, release = false, physicalDevice = false) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(
      "Nhập địa chỉ máy chủ đầy đủ, ví dụ https://api.cuahang.vn",
    );
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  ) {
    throw new Error(
      "Địa chỉ máy chủ chỉ gồm giao thức, tên miền và cổng; không chứa đường dẫn hoặc thông tin đăng nhập.",
    );
  }
  if (physicalDevice && ["10.0.2.2", "10.0.3.2"].includes(url.hostname)) {
    throw new Error(
      "Địa chỉ " +
        url.hostname +
        " chỉ dành cho máy ảo Android. Điện thoại thật cần địa chỉ máy chủ của cửa hàng.",
    );
  }
  if (
    release &&
    (url.protocol !== "https:" ||
      ["localhost", "127.0.0.1", "[::1]", "10.0.2.2"].includes(url.hostname) ||
      url.hostname.endsWith(".localhost"))
  ) {
    throw new Error(
      "Bản vận hành cần máy chủ HTTPS mà điện thoại truy cập được.",
    );
  }
  return url.origin;
}
module.exports = { validateApiOrigin };
