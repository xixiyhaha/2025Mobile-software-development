// 初始化云开发（页面加载前初始化，确保全局可用）
wx.cloud.init({
  env: "cloud1-1grapwhzb010af67" // 替换为你的云环境ID
});
const db = wx.cloud.database();
const diaryCol = db.collection("diaries"); // 全局集合引用，避免重复创建

Page({
  data: {
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth() + 1,
    days: [],
    selectedDate: null,
    currentDiaryContent: "",
    diaries: {},
    isLoading: false, // 控制加载提示
    openid: "" // 缓存当前用户openid
  },

  onLoad() {
    // 页面加载时先校验登录状态
    this.checkLoginStatus().then(isLoggedIn => {
      if (isLoggedIn) {
        // 已登录：初始化日历
        this.generateCalendar();
      } else {
        // 未登录：跳转登录页
        wx.navigateTo({ url: "/pages/login/login" });
      }
    });
  },

  onShow() {
    // 页面再次显示时，重新校验登录状态并刷新日历
    this.checkLoginStatus().then(isLoggedIn => {
      if (isLoggedIn) {
        this.generateCalendar();
      } else {
        wx.navigateTo({ url: "/pages/login/login" });
      }
    });
  },

  /**
   * 新增：校验登录状态（从本地缓存获取用户信息）
   * @returns {Promise<boolean>} 是否已登录
   */
  async checkLoginStatus() {
    try {
      const userInfo = wx.getStorageSync("userInfo");
      // 校验缓存的用户信息是否有效（必须包含openid）
      if (userInfo && userInfo.openid) {
        this.setData({ openid: userInfo.openid });
        return true;
      }
      // 缓存无效时，尝试通过云函数重新获取openid（兼容旧逻辑）
      const { result } = await wx.cloud.callFunction({
        name: "login",
        config: { env: "cloud1-1grapwhzb010af67" }
      });
      if (result && result.openid) {
        // 缓存用户信息（避免后续重复获取）
        const newUserInfo = {
          openid: result.openid,
          avatarUrl: userInfo?.avatarUrl || "",
          nickName: userInfo?.nickName || "未命名用户"
        };
        wx.setStorageSync("userInfo", newUserInfo);
        this.setData({ openid: result.openid });
        return true;
      }
      return false;
    } catch (err) {
      console.error("校验登录状态失败：", err);
      wx.showToast({ title: "登录状态异常，请重试", icon: "none" });
      return false;
    }
  },

  /**
   * 统一日期格式（补零处理，确保格式为 yyyy-MM-dd）
   * @param {number} year - 年份
   * @param {number} month - 月份（1-12）
   * @param {number} day - 日期（1-31）
   * @returns {string} 格式化后的日期字符串
   */
  formatDate(year, month, day) {
    const formatNum = (num) => num.toString().padStart(2, "0");
    // 校验日期有效性（避免生成 2024-02-30 这类无效日期）
    const validDate = new Date(year, month - 1, day);
    if (
      validDate.getFullYear() !== year ||
      validDate.getMonth() + 1 !== month ||
      validDate.getDate() !== day
    ) {
      console.warn(`无效日期：${year}-${month}-${day}，已自动修正`);
      return this.formatDate(
        validDate.getFullYear(),
        validDate.getMonth() + 1,
        validDate.getDate()
      );
    }
    return `${year}-${formatNum(month)}-${formatNum(day)}`;
  },

  /**
   * 批量检查日期是否有日记（减少数据库调用次数）
   * @param {string[]} dateList - 待检查的日期列表（格式：yyyy-MM-dd）
   * @returns {Promise<Set<string>>} 有日记的日期集合
   */
  async batchCheckHasDiary(dateList) {
    const { openid } = this.data;
    if (!openid) return new Set();

    try {
      const res = await diaryCol
        .where({
          date: db.command.in(dateList), // 批量匹配日期
          _openid: openid // 仅查询当前用户的日记
        })
        .field({ date: true }) // 只返回日期字段，减少数据传输
        .get();

      // 构建有日记的日期集合（便于快速查询）
      return new Set(res.data.map(item => item.date));
    } catch (error) {
      console.error("批量检查日记失败：", error);
      wx.showToast({ title: "加载日记状态失败", icon: "none" });
      return new Set();
    }
  },

  /**
   * 生成日历数据（含日记状态标记）
   */
  async generateCalendar() {
    this.setData({ isLoading: true });
    const { currentYear, currentMonth, openid } = this.data;
    if (!openid) {
      this.setData({ isLoading: false });
      return;
    }

    try {
      // 1. 基础日期计算
      const firstDay = new Date(currentYear, currentMonth - 1, 1); // 当月第一天
      const lastDay = new Date(currentYear, currentMonth, 0); // 当月最后一天
      const firstDayWeek = firstDay.getDay(); // 当月第一天是星期几（0=周日）
      const totalDays = lastDay.getDate(); // 当月总天数
      const prevMonthLastDay = new Date(currentYear, currentMonth - 1, 0).getDate(); // 上月最后一天
      const today = new Date();
      const todayDate = this.formatDate(
        today.getFullYear(),
        today.getMonth() + 1,
        today.getDate()
      );

      // 2. 收集当前日历所有日期（含上月、当月、下月补位日期）
      const dateList = [];
      let days = [];

      // 2.1 填充上月补位日期
      for (let i = 0; i < firstDayWeek; i++) {
        const day = prevMonthLastDay - firstDayWeek + i + 1;
        const prevMonth = currentMonth - 1;
        const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
        const dateString = this.formatDate(prevYear, prevMonth, day);
        dateList.push(dateString);
        days.push({
          day: day,
          isCurrentMonth: false,
          isToday: dateString === todayDate,
          dateString: dateString,
          hasDiary: false
        });
      }

      // 2.2 填充当月日期
      for (let i = 1; i <= totalDays; i++) {
        const dateString = this.formatDate(currentYear, currentMonth, i);
        dateList.push(dateString);
        days.push({
          day: i,
          isCurrentMonth: true,
          isToday: dateString === todayDate,
          dateString: dateString,
          hasDiary: false
        });
      }

      // 2.3 填充下月补位日期（确保日历为 6行×7列=42格）
      const remainingCells = 42 - days.length;
      for (let i = 1; i <= remainingCells; i++) {
        const nextMonth = currentMonth + 1;
        const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;
        const dateString = this.formatDate(nextYear, nextMonth, i);
        dateList.push(dateString);
        days.push({
          day: i,
          isCurrentMonth: false,
          isToday: dateString === todayDate,
          dateString: dateString,
          hasDiary: false
        });
      }

      // 3. 批量检查日记状态并更新
      const hasDiaryDates = await this.batchCheckHasDiary(dateList);
      const updatedDays = days.map(day => ({
        ...day,
        hasDiary: hasDiaryDates.has(day.dateString)
      }));

      // 4. 一次性更新页面数据（减少DOM渲染次数）
      this.setData({
        days: updatedDays,
        isLoading: false
      });

    } catch (error) {
      console.error("生成日历失败：", error);
      wx.showToast({ title: "加载日历失败，请重试", icon: "none" });
      this.setData({ isLoading: false });
    }
  },

  /**
   * 同步日记输入内容
   * @param {Event} e - 输入事件
   */
  onDiaryInput(e) {
    this.setData({
      currentDiaryContent: e.detail.value.trim()
    });
  },

  /**
   * 点击日期获取日记内容
   * @param {Event} e - 点击事件（含日期参数）
   */
  async onDayTap(e) {
    const dateString = e.currentTarget.dataset.date;
    const { openid } = this.data;
    if (!openid) {
      wx.showToast({ title: "请先登录", icon: "none" });
      return;
    }

    this.setData({ isLoading: true });
    try {
      const res = await diaryCol
        .where({
          date: dateString,
          _openid: openid
        })
        .get();

      // 同步选中日期和日记内容（无日记时显示空字符串）
      this.setData({
        selectedDate: dateString,
        currentDiaryContent: res.data[0]?.content || ""
      });

    } catch (error) {
      console.error("获取日记失败：", error);
      this.setData({
        selectedDate: dateString,
        currentDiaryContent: ""
      });
      wx.showToast({ title: "获取日记内容失败", icon: "none" });
    } finally {
      this.setData({ isLoading: false });
    }
  },

  /**
   * 保存/删除日记（仅操作当前用户的数据）
   */
  async saveDiary() {
    const { selectedDate, currentDiaryContent, openid } = this.data;
    // 1. 前置校验（日期+登录状态）
    if (!selectedDate) {
      wx.showToast({ title: "请先选择日期", icon: "none" });
      return;
    }
    if (!openid) {
      wx.showToast({ title: "请先登录", icon: "none" });
      wx.navigateTo({ url: "/pages/login/login" });
      return;
    }

    const content = currentDiaryContent.trim();
    this.setData({ isLoading: true });

    try {
      // 2. 查询当前日期是否已有日记
      const res = await diaryCol
        .where({
          date: selectedDate,
          _openid: openid
        })
        .get();

      if (res.data.length > 0) {
        // 3. 已有日记：内容为空则删除，否则更新
        const diaryId = res.data[0]._id;
        if (content === "") {
          await diaryCol.doc(diaryId).remove();
          wx.showToast({ title: "日记删除成功", icon: "success" });
        } else {
          await diaryCol.doc(diaryId).update({
            data: {
              content: content,
              updatedAt: db.serverDate() // 更新时间戳
            }
          });
          wx.showToast({ title: "日记保存成功", icon: "success" });
        }
      } else {
        // 4. 无日记：内容不为空则新增（避免空日记）
        if (content !== "") {
          await diaryCol.add({
            data: {
              date: selectedDate,
              content: content,
              createdAt: db.serverDate(), // 创建时间戳
              updatedAt: db.serverDate()  // 更新时间戳
            }
          });
          wx.showToast({ title: "日记新增成功", icon: "success" });
        } else {
          wx.showToast({ title: "日记内容不能为空", icon: "none" });
          this.setData({ isLoading: false });
          return;
        }
      }

      // 5. 重新生成日历，更新日记状态
      this.generateCalendar();

    } catch (error) {
      console.error("保存日记失败：", error);
      // 细化错误提示（便于定位问题）
      let errorMsg = "操作失败，请重试";
      if (error.errCode === -502003) errorMsg = "权限不足，无法操作日记";
      else if (error.errCode === -502005) errorMsg = "日记集合不存在，请检查云数据库";
      wx.showToast({ title: errorMsg, icon: "none" });
    } finally {
      this.setData({ isLoading: false });
    }
  },

  /**
   * 切换到上个月
   */
  prevMonth() {
    let { currentYear, currentMonth } = this.data;
    if (currentMonth === 1) {
      currentMonth = 12;
      currentYear--;
    } else {
      currentMonth--;
    }
    this.setData({ currentYear, currentMonth }, () => {
      this.generateCalendar();
    });
  },

  /**
   * 切换到下个月
   */
  nextMonth() {
    let { currentYear, currentMonth } = this.data;
    if (currentMonth === 12) {
      currentMonth = 1;
      currentYear++;
    } else {
      currentMonth++;
    }
    this.setData({ currentYear, currentMonth }, () => {
      this.generateCalendar();
    });
  }
});