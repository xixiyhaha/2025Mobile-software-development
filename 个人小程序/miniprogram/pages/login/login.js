const db = wx.cloud.database();
const userCol = db.collection('users');

Page({
  data: {
    userInfo: null,
    isLoading: false,
    showAgreement: false
  },

  onLoad() {
    // 检查是否已登录（有缓存则直接跳首页）
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo && userInfo.openid) {
      this.navigateToHome();
    }
  },

  // 显示用户协议弹窗
  showAgreement() {
    this.setData({ showAgreement: true });
  },

  // 关闭用户协议弹窗
  closeAgreement() {
    this.setData({ showAgreement: false });
  },

  // 获取用户信息并处理登录（与 WXML 中 bindtap 绑定的方法名一致）
  async onGetUserProfile() {
    try {
      // 1. 检查授权状态
      const setting = await wx.getSetting();
      let userInfoRes;

      // 2. 未授权则请求授权，已授权则直接获取
      if (!setting.authSetting['scope.userInfo']) {
        userInfoRes = await wx.getUserProfile({
          desc: '用于完善用户资料和提供个性化服务' // 授权弹窗说明（必填）
        });
      } else {
        userInfoRes = await wx.getUserInfo();
      }

      // 3. 处理获取到的用户信息
      this.handleUserInfo(userInfoRes.userInfo);

    } catch (err) {
      console.error('用户授权失败:', err);
      wx.showToast({ 
        title: '需要授权才能使用功能', 
        icon: 'none',
        duration: 2000
      });
    }
  },

  // 处理用户信息（存云数据库 + 本地缓存）
  async handleUserInfo(userInfo) {
    if (!userInfo) {
      wx.showToast({ title: '获取用户信息失败', icon: 'none' });
      return;
    }

    this.setData({ isLoading: true });
    try {
      // 4. 调用云函数获取用户唯一标识 openid
      const loginRes = await wx.cloud.callFunction({
        name: 'login' // 确保云函数已创建且返回 openid
      });

      if (!loginRes.result || !loginRes.result.openid) {
        throw new Error('无法获取用户标识，请检查云函数');
      }
      const openid = loginRes.result.openid;

      // 5. 检查用户是否已存在（避免重复创建）
      const userQuery = await userCol.where({ _openid: openid }).get();
      let userData;

      if (userQuery.data.length > 0) {
        // 6. 已存在：更新用户信息（如头像、昵称变更）
        const userId = userQuery.data[0]._id;
        await userCol.doc(userId).update({
          data: {
            avatarUrl: userInfo.avatarUrl,
            nickName: userInfo.nickName,
            gender: userInfo.gender || 0, // 0-未知，1-男，2-女
            updatedAt: db.serverDate() // 服务器时间（避免客户端时间偏差）
          }
        });
        userData = { ...userQuery.data[0], ...userInfo, openid };

      } else {
        // 7. 不存在：创建新用户
        const addRes = await userCol.add({
          data: {
            _openid: openid, // 绑定 openid（关键：用于后续查询）
            avatarUrl: userInfo.avatarUrl,
            nickName: userInfo.nickName,
            gender: userInfo.gender || 0,
            createdAt: db.serverDate(),
            updatedAt: db.serverDate(),
            favoriteSongs: [], // 扩展字段：收藏歌曲
            folders: [] // 扩展字段：文件夹
          }
        });
        userData = { 
          _id: addRes._id,
          ...userInfo,
          openid,
          favoriteSongs: [],
          folders: []
        };
      }

      // 8. 保存用户信息到本地缓存（下次打开无需重新登录）
      wx.setStorageSync('userInfo', userData);

      // 9. 跳转到首页
      this.navigateToHome();

    } catch (err) {
      console.error('登录处理失败:', err);
      wx.showToast({ 
        title: err.message || '登录失败，请重试', 
        icon: 'none',
        duration: 2000
      });
    } finally {
      // 10. 无论成功/失败，关闭加载状态
      this.setData({ isLoading: false });
    }
  },

  // 跳转到首页（兼容 switchTab 和 navigateTo）
  navigateToHome() {
    // 优先用 switchTab（适用于 tabBar 页面）
    wx.switchTab({
      url: '/pages/index/index',
      fail: (err) => {
        console.error('switchTab 跳转失败:', err);
        // 失败时用 navigateTo（适用于非 tabBar 页面）
        wx.navigateTo({
          url: '/pages/index/index'
        });
      }
    });
  }
});