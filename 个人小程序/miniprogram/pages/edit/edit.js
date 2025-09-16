// pages/edit/edit.js
wx.cloud.init({
  env: "cloud1-1grapwhzb010af67"
});
const db = wx.cloud.database();
const usersCollection = db.collection("users");

// ✅ 云存储默认头像 fileID
const DEFAULT_AVATAR = "cloud://cloud1-1grapwhzb010af67.636c-cloud1-1grapwhzb010af67-1375656784/images/usercenter.png";

Page({
  data: {
    avatarUrl: "",   // 头像
    nickName: "",    // 昵称
    gender: 0        // 性别: 0未知 1男 2女
  },

  onLoad() {
    this.loadUserInfo();
  },

  // 加载数据库中的用户信息
  async loadUserInfo() {
    try {
      const openid = wx.getStorageSync("openid");
      if (!openid) return;

      const res = await usersCollection.where({ _openid: openid }).get();
      if (res.data.length > 0) {
        const user = res.data[0];
        this.setData({
          avatarUrl: user.avatarUrl || DEFAULT_AVATAR,
          nickName: user.nickName || "",
          gender: user.gender ?? 0
        });
      } else {
        this.setData({ avatarUrl: DEFAULT_AVATAR });
      }
    } catch (err) {
      console.error("加载用户信息失败:", err);
    }
  },

  // 选择头像并上传
  // 选择头像并上传（带兼容处理）
async chooseAvatar() {
  const that = this;
  wx.chooseImage({
    count: 1,
    sizeType: ["compressed"],
    success: async (res) => {
      const filePath = res.tempFilePaths[0];
      const cloudPath = `avatars/${Date.now()}-${Math.floor(Math.random() * 1000)}.png`;

      wx.showLoading({ title: "上传中..." });
      try {
        let finalPath = filePath;

        // 尝试裁剪（仅在支持时执行）
        if (wx.cropImage) {
          try {
            const info = await wx.getImageInfo({ src: filePath });
            const cropRes = await wx.cropImage({
              src: filePath,
              crop: {
                x: 0,
                y: 0,
                width: Math.min(info.width, info.height),
                height: Math.min(info.width, info.height)
              }
            });
            if (cropRes && cropRes.tempFilePath) {
              finalPath = cropRes.tempFilePath;
            }
          } catch (e) {
            console.warn("裁剪失败，使用原图上传:", e);
          }
        } else {
          console.warn("当前环境不支持 wx.cropImage，使用原图上传");
        }

        // 上传（裁剪成功则上传裁剪图，否则上传原图）
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath,
          filePath: finalPath
        });
        that.setData({ avatarUrl: uploadRes.fileID });
      } catch (err) {
        console.error("上传头像失败:", err);
        wx.showToast({ title: "上传失败", icon: "none" });
      } finally {
        wx.hideLoading();
      }
    }
  });
},



  // 输入昵称
  onInputChange(e) {
    this.setData({ nickName: e.detail.value });
  },

  // 性别选择
  onGenderChange(e) {
    this.setData({ gender: Number(e.detail.value) });
  },

  // 保存用户信息
  async saveUserInfo() {
    const openid = wx.getStorageSync("openid");
    if (!openid) {
      wx.showToast({ title: "未登录", icon: "none" });
      return;
    }

    const newUserInfo = {
      avatarUrl: this.data.avatarUrl || DEFAULT_AVATAR,
      nickName: this.data.nickName,
      gender: this.data.gender ?? 0,
      updatedAt: new Date().toISOString()
    };

    try {
      const res = await usersCollection.where({ _openid: openid }).get();
      if (res.data.length > 0) {
        await usersCollection.doc(res.data[0]._id).update({
          data: newUserInfo
        });
      } else {
        await usersCollection.add({
          data: {
            ...newUserInfo,
            createdAt: new Date().toISOString()
          }
        });
      }

      wx.setStorageSync("userInfo", newUserInfo);

      wx.showToast({ title: "保存成功", icon: "success" });
      setTimeout(() => {
        wx.navigateBack();
      }, 800);
    } catch (err) {
      console.error("保存用户信息失败:", err);
      wx.showToast({ title: "保存失败", icon: "none" });
    }
  }
});
