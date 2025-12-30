// Copyright (c) Zefchain Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

use linera_sdk::linera_base_types::Timestamp;
use linera_sdk::views::{
    linera_views, LogView, MapView, RegisterView, RootView, ViewStorageContext,
};
use serde::{Deserialize, Serialize};

/// 问题结构
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Question {
    pub id: String,
    pub text: String,
    pub options: Vec<String>,
    pub correct_options: Vec<u32>,
    pub points: u32,
    #[serde(rename = "type")]
    pub question_type: String,
}

/// 用户信息结构
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct User {
    pub wallet_address: String,
    pub nickname: String,
    pub created_at: Timestamp,
}

/// Quiz模式枚举
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub enum QuizMode {
    Public,       // 公开模式，设置过用户名的用户均可以参与
    Registration, // 报名模式，只允许报名的用户参与
}

/// Quiz开始方式枚举
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub enum QuizStartMode {
    Auto,   // 自动开始，到start_time自动开始
    Manual, // 手动开始，需要创建者手动触发
}

/// Quiz集合结构
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QuizSet {
    pub id: u64,
    pub title: String,
    pub description: String,
    pub creator: String,          // 钱包地址
    pub creator_nickname: String, // 昵称
    pub questions: Vec<Question>,
    pub time_limit: u64, // 秒
    pub start_time: Timestamp,
    pub end_time: Timestamp,
    pub created_at: Timestamp,
    pub mode: QuizMode,
    pub start_mode: QuizStartMode,
    pub is_started: bool,              // 是否已开始
    pub registered_users: Vec<String>, // 报名用户列表（钱包地址）
    pub participant_count: u32,        // 参与人数统计
}

/// 用户答题尝试
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserAttempt {
    pub quiz_id: u64,
    pub user: String,
    pub nickname: String,
    pub answers: Vec<Vec<u32>>, // 每个问题的答案选项索引列表，支持多选
    pub score: u32,
    pub time_taken: u64, // 毫秒
    pub completed_at: Timestamp,
}

/// 应用事件类型
#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum QuizEvent {
    /// 新测验创建事件
    QuizCreated(QuizSet),
    /// 新答案提交事件
    AnswerSubmitted(UserAttempt),
}

/// Quiz应用状态
#[derive(RootView)]
#[view(context = ViewStorageContext)]
pub struct QuizState {
    /// 存储所有Quiz集合 (QuizId -> QuizSet)
    pub quiz_sets: MapView<u64, QuizSet>,
    /// 存储用户答题尝试 ((QuizId, WalletAddress) -> UserAttempt)
    pub user_attempts: MapView<(u64, String), UserAttempt>,
    /// 记录答题事件用于排行榜计算
    pub quiz_events: LogView<UserAttempt>,
    /// 应用事件日志
    pub app_events: LogView<QuizEvent>,
    /// 下一个可用的Quiz ID
    pub next_quiz_id: RegisterView<u64>,
    /// 用户参与的测验集合 (WalletAddress -> Vec<QuizId>)
    pub user_participations: MapView<String, Vec<u64>>,
    /// 测验排行榜 (QuizId -> Vec<super::LeaderboardEntry>)
    pub leaderboard: MapView<u64, Vec<super::LeaderboardEntry>>,
    /// 用户信息存储 (WalletAddress -> User)
    pub users: MapView<String, User>,
    /// 昵称到钱包地址的映射，用于确保昵称唯一
    pub nickname_to_wallet: MapView<String, String>,
    /// 用户创建的测验集合 (WalletAddress -> Vec<QuizId>)
    pub user_created_quizzes: MapView<String, Vec<u64>>,
    /// 测验参与者列表 (QuizId -> Vec<WalletAddress>)
    pub quiz_participants: MapView<u64, Vec<String>>,
}
