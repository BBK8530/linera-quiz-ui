// Copyright (c) Zefchain Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

/*! ABI of the Quiz Application */

use async_graphql::{Enum, InputObject, SimpleObject, Union};
use linera_sdk::graphql::GraphQLMutationRoot;
use linera_sdk::linera_base_types::{ChainId, ContractAbi, ServiceAbi};
use serde::{Deserialize, Serialize};

/// Quiz错误类型枚举
#[derive(Debug, Serialize, Deserialize, Enum, Copy, Clone, PartialEq, Eq)]
pub enum QuizError {
    /// 昵称已被使用
    NicknameAlreadyTaken,
    /// 无效的Quiz模式
    InvalidQuizMode,
    /// 无效的开始模式
    InvalidStartMode,
    /// Quiz尚未开始
    QuizNotStarted,
    /// 用户已经尝试过该Quiz
    UserAlreadyAttempted,
    /// 用户未注册该Quiz
    UserNotRegistered,
    /// 用户已经注册该Quiz
    UserAlreadyRegistered,
    /// Quiz未找到
    QuizNotFound,
    /// 用户未找到
    UserNotFound,
    /// 权限不足
    InsufficientPermissions,
    /// 参数错误
    InvalidParameters,
    /// 内部错误
    InternalError,
}

/// 排序方向枚举
#[derive(Debug, Serialize, Deserialize, Enum, Copy, Clone, Eq, PartialEq)]
pub enum SortDirection {
    /// 升序
    #[graphql(name = "ASC")]
    Asc,
    /// 降序
    #[graphql(name = "DESC")]
    Desc,
}

/// 分页参数
#[derive(Debug, Serialize, Deserialize, InputObject)]
pub struct PaginationParams {
    /// 每页数量
    pub limit: Option<u32>,
    /// 偏移量
    pub offset: Option<u32>,
}

/// 排序参数
#[derive(Debug, Serialize, Deserialize, InputObject)]
pub struct SortParams {
    /// 排序字段
    pub sort_by: Option<String>,
    /// 排序方向
    pub sort_direction: Option<SortDirection>,
}

pub mod state;

pub struct QuizAbi;

/// 用户设置昵称的参数
#[derive(Debug, Serialize, Deserialize, InputObject)]
pub struct SetNicknameParams {
    pub nickname: String,
}

/// 创建Quiz集合的参数
#[derive(Debug, Serialize, Deserialize, InputObject)]
pub struct CreateQuizParams {
    pub title: String,
    pub description: String,
    pub questions: Vec<QuestionParams>,
    pub time_limit: u64,    // 秒
    pub start_time: String, // 毫秒时间戳字符串
    pub end_time: String,   // 毫秒时间戳字符串
    pub nickname: String,
    pub mode: String,       // "public" or "registration"
    pub start_mode: String, // "auto" or "manual"
}

/// 问题参数
#[derive(Debug, Serialize, Deserialize, Clone, SimpleObject, InputObject)]
#[graphql(input_name = "QuestionParamsInput")]
pub struct QuestionParams {
    pub text: String,
    pub options: Vec<String>,
    pub correct_options: Vec<u32>,
    pub points: u32,
    #[serde(rename = "type")]
    pub question_type: String,
    pub id: String,
}

/// 答案选项结构体，包含题目ID和对应的答案
#[derive(Debug, Serialize, Deserialize, InputObject)]
pub struct AnswerOption {
    pub question_id: String,
    pub selected_answers: Vec<u32>, // 答案选项索引列表，支持多选
}

/// 提交答案的参数
#[derive(Debug, Serialize, Deserialize, InputObject)]
pub struct SubmitAnswersParams {
    pub quiz_id: u64,
    pub answers: Vec<AnswerOption>, // 每个问题的答案选项索引列表，支持多选
    pub time_taken: u64,            // 毫秒
    pub nickname: String,
}

/// Quiz模式枚举
#[derive(Debug, Serialize, Deserialize, Enum, Copy, Clone, Eq, PartialEq)]
pub enum QuizMode {
    #[graphql(name = "public")]
    Public,
    #[graphql(name = "registration")]
    Registration,
}

/// Quiz开始方式枚举
#[derive(Debug, Serialize, Deserialize, Enum, Copy, Clone, Eq, PartialEq)]
pub enum QuizStartMode {
    #[graphql(name = "auto")]
    Auto,
    #[graphql(name = "manual")]
    Manual,
}

/// 排行榜条目
#[derive(Debug, Serialize, Deserialize, SimpleObject, Clone)]
pub struct LeaderboardEntry {
    pub user: String,
    pub score: u32,
    pub time_taken: u64,
}

/// 应用支持的操作
#[derive(Debug, Serialize, Deserialize, GraphQLMutationRoot)]
pub enum Operation {
    /// 用户设置昵称
    SetNickname(SetNicknameParams),
    /// 创建新的Quiz集合
    CreateQuiz(CreateQuizParams),
    /// 提交Quiz答案
    SubmitAnswers(SubmitAnswersParams),
    /// 开始Quiz（仅创建者可调用）
    StartQuiz(u64),
    /// 报名参与Quiz
    RegisterForQuiz(u64),
}

/// 跨链消息类型
#[derive(Debug, Serialize, Deserialize)]
pub enum Message {
    /// 设置昵称跨链消息
    SetNickname {
        from_chain_id: ChainId,
        params: SetNicknameParams,
    },
    /// 创建Quiz跨链消息
    CreateQuiz {
        from_chain_id: ChainId,
        params: CreateQuizParams,
    },
    /// 提交答案跨链消息
    SubmitAnswers {
        from_chain_id: ChainId,
        params: SubmitAnswersParams,
    },
    /// 开始Quiz跨链消息
    StartQuiz {
        from_chain_id: ChainId,
        quiz_id: u64,
    },
    /// 报名Quiz跨链消息
    RegisterForQuiz {
        from_chain_id: ChainId,
        quiz_id: u64,
    },
}

/// 应用支持的查询
#[derive(Debug, Serialize, Deserialize)]
pub enum Query {
    /// 获取所有Quiz集合
    GetQuizSets,
    /// 获取Quiz集合详情
    GetQuizSet(u64),
    /// 获取用户的Quiz尝试记录
    GetUserAttempts(String),
    /// 获取Quiz排行榜
    GetLeaderboard,
    /// 获取单个Quiz的排行榜
    GetQuizLeaderboard(u64),
    /// 获取用户参与的测验集合
    GetUserParticipations(String),
    /// 获取用户创建的测验集合
    GetUserCreatedQuizzes(String),
    /// 获取用户参与的测验集合详情
    GetUserParticipatedQuizzes(String),
}

/// 用户信息视图
#[derive(Debug, Serialize, Deserialize, SimpleObject, Clone)]
pub struct UserView {
    pub wallet_address: String,
    pub nickname: String,
    pub created_at: String, // 微秒时间戳字符串
}

/// 用户答题尝试视图
#[derive(Debug, Serialize, Deserialize, SimpleObject, Clone, PartialEq, Eq)]
pub struct UserAttemptView {
    pub quiz_id: u64,
    pub user: String,     // 钱包地址
    pub nickname: String, // 昵称
    pub answers: Vec<Vec<u32>>,
    pub score: u32,
    pub time_taken: u64,
    pub completed_at: String, // 微秒时间戳字符串
}

/// 测验尝试记录
#[derive(Debug, Serialize, Deserialize, SimpleObject, Clone)]
pub struct QuizAttempt {
    pub quiz_id: u64,
    pub attempt: UserAttemptView,
}

/// Quiz集合视图
#[derive(Debug, Serialize, Deserialize, SimpleObject, Clone, PartialEq, Eq)]
pub struct QuizSetView {
    pub id: u64,
    pub title: String,
    pub description: String,
    pub creator: String,          // 钱包地址
    pub creator_nickname: String, // 昵称
    pub questions: Vec<QuestionView>,
    pub start_time: String,            // 微秒时间戳字符串
    pub end_time: String,              // 微秒时间戳字符串
    pub created_at: String,            // 微秒时间戳字符串
    pub mode: String,                  // "public" or "registration"
    pub start_mode: String,            // "auto" or "manual"
    pub is_started: bool,              // 是否已开始
    pub registered_users: Vec<String>, // 报名用户列表
    pub participant_count: u32,        // 参与人数统计
}

/// 问题视图
#[derive(Debug, Serialize, Deserialize, SimpleObject, Clone, PartialEq, Eq)]
pub struct QuestionView {
    pub id: String,
    pub text: String,
    pub options: Vec<String>,
    pub points: u32,
    #[serde(rename = "type")]
    #[graphql(name = "type")]
    pub question_type: String,
}

/// 应用事件类型
#[derive(Debug, Serialize, Deserialize, Union, Clone, PartialEq, Eq)]
pub enum QuizEvent {
    /// 新测验创建事件
    QuizCreated(QuizSetView),
    /// 新答案提交事件
    AnswerSubmitted(UserAttemptView),
}

/// 查询响应
#[derive(Debug, Serialize, Deserialize)]
pub enum QueryResponse {
    /// 所有Quiz集合
    QuizSets(Vec<QuizSetView>),
    /// Quiz集合详情
    QuizSet(Option<QuizSetView>),
    /// 用户尝试记录列表
    UserAttempts(Vec<QuizAttempt>),
    Leaderboard(Vec<UserAttemptView>),
    QuizLeaderboard(Vec<UserAttemptView>),
    UserParticipations(Vec<u64>),
    /// 用户创建的测验集合
    UserCreatedQuizzes(Vec<QuizSetView>),
    /// 用户参与的测验集合
    UserParticipatedQuizzes(Vec<QuizSetView>),
}

impl ContractAbi for QuizAbi {
    type Operation = Operation;
    type Response = Result<(), QuizError>;
}

impl ServiceAbi for QuizAbi {
    type Query = async_graphql::Request;
    type QueryResponse = async_graphql::Response;
}
