-- phpMyAdmin SQL Dump
-- version 4.4.15.10
-- https://www.phpmyadmin.net
--
-- Host: localhost
-- Generation Time: 2022-02-07 17:08:12
-- 服务器版本： 5.6.50-log
-- PHP Version: 5.6.40

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `lj_xxbke_com`
--

-- --------------------------------------------------------

--
-- 表的结构 `sq_type`
--

CREATE TABLE IF NOT EXISTS `sq_type` (
  `id` tinyint(11) unsigned NOT NULL,
  `name` varchar(50) NOT NULL COMMENT '分类名称',
  `add_time` int(11) NOT NULL COMMENT '添加时间'
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8 ROW_FORMAT=COMPACT COMMENT='分类表';

--
-- 转存表中的数据 `sq_type`
--

INSERT INTO `sq_type` (`id`, `name`, `add_time`) VALUES
(1, '可回收垃圾', 0),
(2, '有害垃圾', 9),
(4, '厨余垃圾', 0),
(8, '干垃圾', 0),
(16, '大件垃圾', 0);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `sq_type`
--
ALTER TABLE `sq_type`
  ADD PRIMARY KEY (`id`) USING BTREE;

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `sq_type`
--
ALTER TABLE `sq_type`
  MODIFY `id` tinyint(11) unsigned NOT NULL AUTO_INCREMENT,AUTO_INCREMENT=17;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
