// index.js（已修改，替换原文件）
wx.cloud.init({
  env: "cloud1-1grapwhzb010af67",
  traceUser: true
});

const db = wx.cloud.database();
const foldersCollection = db.collection('songFolders');

Page({
  data: {
    folderList: [],
    showCreateDialog: false,
    newFolderName: '',
    showRenameDialog: false,
    renameFolderName: '',
    renameFolderId: '',
    isLoading: false,
    isRenaming: false,
    themeColor: '#07c160'
  },
  
  onLoad() {
    // 加载主题颜色
    const app = getApp();
    this.setData({
      themeColor: app.globalData.themeColor
    });
    
    // 立即应用主题色到导航栏
    this.syncThemeColor();
    
    // 尽量在 onLoad 获取 openid 缓存
    this.getOpenid().then(() => {
      this.loadFolders();
    }).catch(() => {
      // 仍然尝试加载（getOpenid 内部会打印错误）
      this.loadFolders();
    });
    
    // 注册主题颜色变化监听器
    this.registerThemeListener();
  },

  onShow() {
    this.loadFolders();
    
    // 每次页面显示时无条件同步主题颜色
    this.syncThemeColor();
  },
  
  /**
   * 同步主题颜色到页面元素
   */
  syncThemeColor() {
    try {
      // 获取全局应用实例
      const app = getApp();
      // 获取主题颜色（优先从全局数据，其次从本地存储）
      const themeColor = app.globalData.themeColor || wx.getStorageSync('themeColor') || '#07c160';
      
      // 对于白色主题，需要将文字颜色设置为黑色以保证可见性
      const frontColor = themeColor === '#f8f8f8' ? '#000000' : '#ffffff';
      
      // 设置导航栏颜色
      wx.setNavigationBarColor({
        frontColor: frontColor,
        backgroundColor: themeColor,
        animation: {
          duration: 300
        }
      });
      
      // 更新页面主题色数据
      this.setData({
        themeColor: themeColor
      });
    } catch (error) {
      console.error('同步主题颜色失败:', error);
    }
  },
  
  // 注册主题颜色变化监听器
  registerThemeListener() {
    const app = getApp();
    this.themeColorListener = (data) => {
      const { color } = data;
      this.syncThemeColor();
    };
    app.on('themeColorChanged', this.themeColorListener);
  },
  
  // 取消注册主题色变化监听器
  unregisterThemeListener() {
    if (this.themeColorListener) {
      const app = getApp();
      app.off('themeColorChanged', this.themeColorListener);
      this.themeColorListener = null;
    }
  },
  
  // 页面卸载时取消注册监听器
  onUnload() {
    this.unregisterThemeListener();
  },

  // 获取 openid 的通用方法（优先缓存）
  async getOpenid() {
    let openid = wx.getStorageSync('openid');
    if (openid) {
      return openid;
    }

    // 也尝试从 userInfo 中读取
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo && userInfo.openid) {
      wx.setStorageSync('openid', userInfo.openid);
      return userInfo.openid;
    }

    // 最后调用云函数获取
    try {
      const res = await wx.cloud.callFunction({ name: 'login', config: { env: "cloud1-1grapwhzb010af67" } });
      if (res && res.result && res.result.openid) {
        wx.setStorageSync('openid', res.result.openid);
        return res.result.openid;
      }
    } catch (err) {
      console.warn('getOpenid: 调用云函数失败', err);
    }
    // 如果都拿不到，返回 null
    return null;
  },

  // 更稳健的加载文件夹（推荐使用）
  async loadFolders() {
    this.setData({ isLoading: true });
    try {
      const openid = await this.getOpenid();
      if (!openid) {
        // 依然尝试无条件拉取（兼容测试数据）
        console.warn('loadFolders: openid 不存在，尝试拉取所有数据并本地过滤');
      }

      // 优先用 _openid 查询（最稳妥），如果 openid 为空则退化到全表拉取（开发时注意）
      let res;
      if (openid) {
        res = await foldersCollection.where({ _openid: openid }).orderBy('createTime', 'desc').get();
      } else {
        res = await foldersCollection.orderBy('createTime', 'desc').get();
      }

      // 统一标准化字段，兼容多种命名（audioFileID / audioUrl / audiofileid / audioId）
      const folderList = (res.data || []).map(item => {
        const audioFileID = item.audioFileID || item.audiofileid || item.audioId || item.audioid || item.audioUrl || item.audio || '';
        const audioName = item.audioName || item.audio_name || item.audioFilename || '';
        return {
          folderId: item._id || item.folderId || '',
          name: item.name || '未命名文件夹',
          createTime: item.createTime || item.create_time || '',
          videoList: item.videoList || item.video_list || [],
          audioFileID: audioFileID,
          audioName: audioName
        };
      });

      // debug 输出，若你仍看到问题请打开控制台查看这里的内容
      console.log('loadFolders -> raw db data:', res.data);
      console.log('loadFolders -> normalized folderList:', folderList);

      this.setData({ folderList });
    } catch (err) {
      console.error('loadFolders 错误:', err);
      wx.showToast({ title: '加载文件夹失败', icon: 'none' });
    } finally {
      this.setData({ isLoading: false });
    }
  },

  // 备用/兼容的加载方法（保留以防其它地方调用）
  async loadFolderList() {
    this.setData({ isLoading: true });
    try {
      const openid = await this.getOpenid();
      const res = await db.collection("songFolders")
        .where(openid ? { _openid: openid } : {}) // 如果 openid 存在就用它，否则不加 where（注意大数据时慎用）
        .get();

      const normalizedFolders = (res.data || []).map(folder => {
        // 兼容混乱字段名
        const audioFileID = folder.audioFileID || folder.audiofileid || folder.audioUrl || folder.audio || '';
        return {
          folderId: folder._id || folder.folderId || '',
          name: folder.name || '未命名文件夹',
          videoList: folder.videoList || [],
          audioFileID
        };
      });

      console.log('loadFolderList -> normalizedFolders:', normalizedFolders);
      this.setData({ folderList: normalizedFolders, isLoading: false });
    } catch (err) {
      console.error('loadFolderList 错误:', err);
      this.setData({ isLoading: false });
    }
  },

  showCreateDialog() {
    this.setData({ showCreateDialog: true, newFolderName: '' });
  },
  hideCreateDialog() {
    this.setData({ showCreateDialog: false });
  },
  onFolderNameInput(e) {
    this.setData({ newFolderName: e.detail.value.trim() });
  },

  showRenameDialog(e) {
    const { folderid, foldername } = e.currentTarget.dataset;
    this.setData({
      showRenameDialog: true,
      renameFolderId: folderid,
      renameFolderName: foldername
    });
  },

  hideRenameDialog() {
    this.setData({
      showRenameDialog: false,
      renameFolderId: '',
      renameFolderName: ''
    });
  },

  onRenameFolderNameInput(e) {
    this.setData({ renameFolderName: e.detail.value.trim() });
  },

  // 创建文件夹时统一用 audioFileID 字段初始化
  async confirmCreateFolder() {
    const { newFolderName } = this.data;
    if (!newFolderName) {
      wx.showToast({ title: '请输入文件夹名称', icon: 'none' });
      return;
    }

    const openid = await this.getOpenid();
    if (!openid) {
      wx.showToast({ title: '无法获取用户信息', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '创建中...' });
    try {
      await foldersCollection.add({
        data: {
          userId: openid,
          name: newFolderName,
          createTime: db.serverDate(),
          videoList: [],
          audioFileID: '', // 统一字段
          audioName: '',
          lyricContent: '',
          recordingList: []
        }
      });

      wx.showToast({ title: '创建成功' });
      this.hideCreateDialog();
      this.loadFolders();
    } catch (err) {
      console.error('confirmCreateFolder 错误:', err);
      wx.showToast({ title: '创建失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  async confirmRenameFolder() {
    const { renameFolderName, renameFolderId } = this.data;
    if (!renameFolderName) {
      wx.showToast({ title: '请输入文件夹名称', icon: 'none' });
      return;
    }

    if (!renameFolderId) {
      wx.showToast({ title: '文件夹ID无效', icon: 'none' });
      return;
    }

    this.setData({ isRenaming: true });
    try {
      await foldersCollection.doc(renameFolderId).update({
        data: {
          name: renameFolderName
        }
      });

      wx.showToast({ title: '重命名成功' });
      this.hideRenameDialog();
      this.loadFolders();
    } catch (err) {
      console.error('confirmRenameFolder 错误:', err);
      wx.showToast({ title: '重命名失败', icon: 'none' });
    } finally {
      this.setData({ isRenaming: false });
    }
  },

  enterFolder(e) {
    const folderId = e.currentTarget.dataset.folderid;
    if (!folderId) {
      wx.showToast({ title: '文件夹ID无效', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: `/pages/folder/detail?folderId=${folderId}` });
  },

  async deleteFolder(e) {
    const folderId = e.currentTarget.dataset.folderid;
    if (!folderId) {
      wx.showToast({ title: '文件夹ID无效', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '确认删除',
      content: '删除后文件夹内的所有内容都会被删除，不可恢复',
      cancelText: '取消',
      confirmText: '删除',
      confirmColor: '#ff4d4f',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' });
          try {
            await foldersCollection.doc(folderId).remove();
            wx.showToast({ title: '删除成功' });
            this.loadFolders();
          } catch (err) {
            console.error('deleteFolder 错误:', err);
            wx.showToast({ title: '删除失败', icon: 'none' });
          } finally {
            wx.hideLoading();
          }
        }
      }
    });
  }
});
