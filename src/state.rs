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

/// Quiz集合结构
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QuizSet {
    pub id: u64,
    pub title: String,
    pub description: String,
    pub creator: String,
    pub questions: Vec<Question>,
    pub time_limit: u64, // 秒
    pub start_time: Timestamp,
    pub end_time: Timestamp,
    pub created_at: Timestamp,
}

/// 用户答题尝试
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserAttempt {
    pub quiz_id: u64,
    pub user: String,
    pub answers: Vec<Vec<u32>>, // 每个问题的答案选项索引列表，支持多选
    pub score: u32,
    pub time_taken: u64, // 毫秒
    pub completed_at: Timestamp,
}

/// Quiz应用状态
#[derive(RootView)]
#[view(context = ViewStorageContext)]
pub struct QuizState {
    /// 存储所有Quiz集合 (QuizId -> QuizSet)
    pub quiz_sets: MapView<u64, QuizSet>,
    /// 存储用户答题尝试 ((QuizId, User) -> UserAttempt)
    pub user_attempts: MapView<(u64, String), UserAttempt>,
    /// 记录答题事件用于排行榜计算
    pub quiz_events: LogView<UserAttempt>,
    /// 下一个可用的Quiz ID
    pub next_quiz_id: RegisterView<u64>,
    /// 用户参与的测验集合 (User -> Vec<QuizId>)
    pub user_participations: MapView<String, Vec<u64>>,
    /// 测验排行榜 (QuizId -> Vec<super::LeaderboardEntry>)
    pub leaderboard: MapView<u64, Vec<super::LeaderboardEntry>>,
}
