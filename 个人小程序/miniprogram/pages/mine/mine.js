Page({
  data: {
    userInfo: null // 存储从本地缓存读取的用户信息
  },

  onLoad() {
    // 页面加载时，读取本地缓存的用户信息
    this.loadUserInfo();
  },

  // 监听页面显示（每次进入“我的”板块都刷新用户信息）
  onShow() {
    this.loadUserInfo();
  },

  // 读取本地缓存的用户信息
  loadUserInfo() {
    const userInfo = wx.getStorageSync("userInfo");
    this.setData({ userInfo: userInfo });
  },

  // 未登录时，跳转到登录页面
  gotoLogin() {
    wx.navigateTo({
      url: "/pages/login/login"
    });
  },

  // 退出登录：清除本地缓存
  logout() {
    wx.showModal({
      title: "确认退出",
      content: "退出后需重新登录，是否继续？",
      confirmText: "退出",
      confirmColor: "#F44336",
      success: (res) => {
        if (res.confirm) {
          // 清除本地缓存
          wx.removeStorageSync("userInfo");
          // 刷新页面
          this.setData({ userInfo: null });
          // 跳转到登录页
          this.gotoLogin();
        }
      }
    });
  }
});