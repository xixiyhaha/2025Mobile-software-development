// 初始化云开发（只保留核心配置，使用固定环境ID）
wx.cloud.init({
  env: "cloud1-1grapwhzb010af67", // 替换为你的云开发环境ID（在云开发控制台获取）
  traceUser: true // 开启用户跟踪，便于调试
});

const db = wx.cloud.database();
const foldersCollection = db.collection('songFolders'); // 文件夹集合名

Page({
  data: {
    folderList: [], // 文件夹列表
    showCreateDialog: false, // 是否显示新建对话框
    newFolderName: '' // 新文件夹名称
  },

  // 页面加载时加载文件夹
  onLoad() {
    this.loadFolders();
  },

  // 页面显示时重新加载（确保数据最新）
  onShow() {
    this.loadFolders();
  },

  // 加载用户的所有文件夹
  async loadFolders() {
    wx.showLoading({ title: '加载中...' });
    try {
      // 获取当前用户的openid（用于数据隔离）
      const userInfo = wx.getStorageSync('userInfo');
      if (!userInfo) {
        wx.navigateTo({ url: '/pages/login/login' });
        return;
      }

      // 查询当前用户的文件夹（按创建时间倒序）
      const res = await foldersCollection
        .where({
          userId: userInfo.openid // 只查询当前用户的文件夹
        })
        .orderBy('createTime', 'desc')
        .get();

      // 格式化文件夹数据（添加folderId字段）
      const folderList = res.data.map(item => ({
        folderId: item._id, // 将数据库ID作为folderId
        name: item.name,
        createTime: item.createTime,
        videoList: item.videoList || [],
        audioUrl: item.audioUrl
      }));

      this.setData({ folderList });
    } catch (err) {
      wx.showToast({ title: '加载文件夹失败', icon: 'none' });
      console.error('加载文件夹错误：', err);
    } finally {
      wx.hideLoading();
    }
  },
  
  // 加载文件夹列表的方法中添加数据验证
  async loadFolderList() {
    this.setData({ isLoading: true });
    try {
      const openid = wx.getStorageSync("openid");
      const res = await db.collection("songFolders")
        .where({ _openid: openid })
        .get();

      // 数据验证和标准化处理
      const normalizedFolders = (res.data || []).map(folder => {
        // 确保folder是对象
        if (typeof folder !== 'object' || folder === null) {
          return { folderId: '', name: '无效文件夹', videoList: [], audioFileID: '' };
        }
        
        // 确保关键字段存在
        return {
          folderId: folder._id || folder.folderId || '',
          name: folder.name || '未命名文件夹',
          videoList: folder.videoList || [],
          // 标准化audioFileID字段
          audioFileID: folder.audioFileID || folder.audiofileid || folder.audioUrl || ''
        };
      });

      this.setData({
        folderList: normalizedFolders,
        isLoading: false
      });

      // 控制台输出调试信息
      console.log("标准化后的文件夹数据:", normalizedFolders);
    } catch (err) {
      console.error("加载文件夹列表失败:", err);
      this.setData({ isLoading: false });
    }
  },

  // 显示新建文件夹对话框
  showCreateDialog() {
    this.setData({ showCreateDialog: true, newFolderName: '' });
  },

  // 隐藏新建文件夹对话框
  hideCreateDialog() {
    this.setData({ showCreateDialog: false });
  },

  // 输入文件夹名称
  onFolderNameInput(e) {
    this.setData({ newFolderName: e.detail.value.trim() });
  },

  // 确认创建文件夹
  async confirmCreateFolder() {
    const { newFolderName } = this.data;
    if (!newFolderName) {
      wx.showToast({ title: '请输入文件夹名称', icon: 'none' });
      return;
    }

    // 获取当前用户信息
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }

    wx.showLoading({ title: '创建中...' });
    try {
      // 新增文件夹到数据库
      await foldersCollection.add({
        data: {
          userId: userInfo.openid, // 关联用户
          name: newFolderName, // 文件夹名称
          createTime: db.serverDate(), // 服务器时间（避免客户端时间偏差）
          videoList: [], // 初始视频列表为空
          audioUrl: '', // 初始无伴奏
          audioName: '', // 伴奏名称
          lyricContent: '', // 初始无歌词
          recordingList: [] // 初始无录音
        }
      });

      wx.showToast({ title: '创建成功' });
      this.hideCreateDialog();
      this.loadFolders(); // 重新加载文件夹列表
    } catch (err) {
      wx.showToast({ title: '创建失败', icon: 'none' });
      console.error('创建文件夹错误：', err);
    } finally {
      wx.hideLoading();
    }
  },

  // 进入文件夹详情页
  enterFolder(e) {
    const folderId = e.currentTarget.dataset.folderid;
    if (!folderId) {
      wx.showToast({ title: '文件夹ID无效', icon: 'none' });
      return;
    }

    // 跳转到详情页并携带folderId
    wx.navigateTo({
      url: `/pages/folder/detail?folderId=${folderId}`,
      fail: () => {
        wx.showToast({ title: '跳转失败，请重试', icon: 'none' });
      }
    });
  },

  // 删除文件夹
  async deleteFolder(e) {
    const folderId = e.currentTarget.dataset.folderid;
    if (!folderId) {
      wx.showToast({ title: '文件夹ID无效', icon: 'none' });
      return;
    }

    // 二次确认删除
    wx.showModal({
      title: '确认删除',
      content: '删除后文件夹内的所有内容（视频、音频、歌词）都会被删除，不可恢复',
      cancelText: '取消',
      confirmText: '删除',
      confirmColor: '#ff4d4f',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' });
          try {
            // 删除数据库中的文件夹
            await foldersCollection.doc(folderId).remove();
            wx.showToast({ title: '删除成功' });
            this.loadFolders(); // 重新加载列表
          } catch (err) {
            wx.showToast({ title: '删除失败', icon: 'none' });
            console.error('删除文件夹错误：', err);
          } finally {
            wx.hideLoading();
          }
        }
      }
    });
  }
});