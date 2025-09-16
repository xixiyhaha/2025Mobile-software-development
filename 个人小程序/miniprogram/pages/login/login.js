// login.js
wx.cloud.init({ env: "cloud1-1grapwhzb010af67" });
const db = wx.cloud.database();
const usersCol = db.collection("users");

Page({
  data: {
    isLoading: false
  },

  async onGetUserProfile() {
    try {
      this.setData({ isLoading: true });

      // 获取微信资料
      const profile = await wx.getUserProfile({
        desc: "用于完善个人资料"
      });

      // 调用云函数获取 openid
      const loginRes = await wx.cloud.callFunction({ name: "login" });
      const openid = loginRes.result.openid;
      wx.setStorageSync("openid", openid);

      // 查询数据库是否已有该用户
      const res = await usersCol.where({ _openid: openid }).get();

      let userData;
      if (res.data.length === 0) {
        // 新用户：用微信资料初始化
        userData = {
          avatarUrl: profile.userInfo.avatarUrl,
          nickName: profile.userInfo.nickName,
          gender: profile.userInfo.gender || 0,
          createdAt: db.serverDate(),
          updatedAt: db.serverDate()
        };
        await usersCol.add({ data: userData });
      } else {
        // 已有用户：保留数据库中的资料，不覆盖用户手动修改的昵称、头像等
        userData = res.data[0];
        // 只更新时间戳
        await usersCol.doc(userData._id).update({
          data: { updatedAt: db.serverDate() }
        });
      }

      // 更新本地缓存
      wx.setStorageSync("userInfo", { ...userData, openid });

      wx.showToast({ title: "登录成功" });
      wx.navigateBack();
    } catch (err) {
      console.error("登录失败:", err);
      wx.showToast({ title: "登录失败", icon: "none" });
    } finally {
      this.setData({ isLoading: false });
    }
  }
});
