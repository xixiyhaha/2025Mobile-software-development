Page({
  data: { 
    videoUrl: '',
    title: '视频播放',
    isLoading: true,
    error: false,
    errorMsg: '',
    useWebView: false // true = web-view 播放, false = <video> 播放
  },

  onLoad(options) {
    let videoData = null;

    // 推荐的新方式：传入 video 对象
    if (options.video) {
      try {
        videoData = JSON.parse(decodeURIComponent(options.video));
      } catch (err) {
        console.error("解析 video 参数失败:", err);
      }
    } 
    // 兼容旧方式：直接传 url
    else if (options.url) {
      videoData = {
        title: options.title || '视频播放',
        realPlayUrl: decodeURIComponent(options.url)
      };
    }

    if (!videoData) {
      this.setData({ error: true, errorMsg: '视频信息无效', isLoading: false });
      return;
    }

    const url = videoData.realPlayUrl || videoData.webUrl;

    if (!url || !url.startsWith('http')) {
      this.setData({ error: true, errorMsg: '无效的视频链接', isLoading: false });
      return;
    }

    // 判断是否为直链格式（mp4/m3u8/mov/avi/flv）
    const isDirectVideo = /\.(mp4|m3u8|mov|avi|flv)(\?|$)/i.test(url);

    this.setData({
      title: videoData.title || '视频播放',
      videoUrl: url,
      useWebView: !isDirectVideo, // 直链 → <video>，否则 → web-view
      isLoading: true,
      error: false,
      errorMsg: ''
    });
  },

  // web-view 加载成功
  onWebViewLoad() {
    this.setData({ isLoading: false });
  },

  // web-view 加载失败
  onWebViewError(e) {
    console.error('web-view加载错误:', e.detail);
    this.setData({ 
      isLoading: false, 
      error: true,
      errorMsg: '视频加载失败，请稍后重试'
    });
    wx.showToast({ title: '视频加载失败', icon: 'none' });
  },

  // <video> 播放错误
  onVideoError(e) {
    console.error('video 播放错误:', e.detail);
    this.setData({
      isLoading: false,
      error: true,
      errorMsg: '视频播放失败（文件格式或地址不支持）'
    });
    wx.showToast({ title: '视频播放失败', icon: 'none' });
  },

  // 重试按钮
  retryLoad() {
    this.setData({ 
      isLoading: true, 
      error: false,
      errorMsg: ''
    });
    const currentUrl = this.data.videoUrl;
    this.setData({ videoUrl: '' }, () => {
      this.setData({ videoUrl: currentUrl });
    });
  },

  // 复制链接
  copyVideoUrl() {
    wx.setClipboardData({
      data: this.data.videoUrl,
      success: () => {
        wx.showToast({ title: '链接已复制', icon: 'success' });
      }
    });
  }
});
