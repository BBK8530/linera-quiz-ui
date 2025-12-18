<template>
  <div class="w-full max-w-5xl mx-auto">
    <!-- Copy Success Prompt -->
    <v-snackbar
      v-model="showNotification"
      :color="notificationType"
      location="top center"
      timeout="3000"
      density="compact"
      close-icon="mdi-close"
    >
      <v-icon class="mr-2">{{
        notificationType === "success" ? "mdi-check-circle" : "mdi-alert-circle"
      }}</v-icon>
      {{ notificationMessage }}
    </v-snackbar>

    <!-- Time Status Prompt -->
    <v-alert
      v-if="timeStatus !== 'active'"
      :color="timeStatus === 'not_started' ? 'info' : 'error'"
      density="compact"
      class="mb-6 mx-auto max-w-3xl"
    >
      <v-icon class="mr-2">{{
        timeStatus === "not_started" ? "mdi-clock-outline" : "mdi-clock-alert"
      }}</v-icon>
      {{ timeStatusMessage }}
    </v-alert>

    <v-row justify="center">
      <v-col cols="24" lg="8">
        <v-card v-if="loading" elevation="8" rounded="2xl" class="py-16">
          <v-card-text class="text-center">
            <v-progress-circular
              indeterminate
              size="64"
              color="primary"
              class="mb-6"
            ></v-progress-circular>
            <p class="text-xl text-gray-600 font-medium">Loading quiz...</p>
          </v-card-text>
        </v-card>

        <v-card
          v-else-if="errorMessage || timeStatus !== 'active'"
          elevation="8"
          rounded="2xl"
          class="border-l-4 border-error"
        >
          <v-card-text class="p-8">
            <div class="flex items-start">
              <v-icon class="mr-4 text-error" size="32">
                mdi-alert-circle
              </v-icon>
              <div>
                <h3 class="text-lg font-medium text-gray-900">
                  {{
                    timeStatus !== "active"
                      ? "Quiz unavailable"
                      : "Loading failed"
                  }}
                </h3>
                <p class="mt-2 text-sm text-gray-600">
                  {{
                    timeStatus !== "active" ? timeStatusMessage : errorMessage
                  }}
                </p>
                <div class="mt-6">
                  <v-btn
                    color="primary"
                    variant="outlined"
                    @click="router.push('/')"
                    >Return to home</v-btn
                  >
                </div>
              </div>
            </div>
          </v-card-text>
        </v-card>

        <v-card
          v-else
          elevation="8"
          rounded="2xl"
          class="overflow-hidden transition-all duration-300 hover:elevation-12"
        >
          <!-- 问卷头部 -->
          <v-card-title
            class="bg-gradient-to-r from-primary to-primary/90 text-white py-6 px-8"
          >
            <div>
              <h1
                class="text-[clamp(1.5rem,3vw,2.5rem)] font-bold mb-2 tracking-tight"
              >
                {{ quiz.title }}
              </h1>
              <p class="text-white mb-4">{{ quiz.description }}</p>
              <v-row class="flex-wrap justify-between items-center gap-4">
                <v-chip
                  color="white"
                  variant="outlined"
                  density="compact"
                  class="bg-white/20 text-white border-white/40"
                >
                  Question {{ currentQuestionIndex + 1 }} /
                  {{ quiz.questions.length }}
                </v-chip>
                <v-col cols="12" sm="auto">
                  <v-row align="center" gap="4">
                    <v-chip
                      color="white"
                      variant="outlined"
                      density="compact"
                      class="bg-white/20 text-white border-white/40"
                    >
                      Time: {{ formatTime(currentQuestionTime) }}
                    </v-chip>
                    <v-btn
                      @click="copyQuizLink()"
                      color="white"
                      variant="text"
                      density="compact"
                      start-icon="mdi-content-copy"
                    >
                      Copy Link
                    </v-btn>
                  </v-row>
                </v-col>
              </v-row>
            </div>
          </v-card-title>

          <!-- 题目内容 -->
          <v-card-text class="p-8">
            <div v-if="currentQuestion" class="mb-8">
              <h2
                class="text-2xl font-semibold mb-6 text-gray-800 leading-tight"
              >
                {{ currentQuestion.text }}
              </h2>
              <v-chip
                color="primary"
                variant="outlined"
                density="compact"
                class="bg-primary/10 border-primary/30 text-primary"
              >
                Points: {{ currentQuestion.points }}
              </v-chip>

              <div class="space-y-4 mt-8">
                <div
                  v-for="(option, index) in currentQuestion.options"
                  :key="index"
                  class="cursor-pointer"
                  @click="selectAnswer(index)"
                >
                  <v-card
                    :elevation="selectedAnswer === index ? 4 : 0"
                    variant="outlined"
                    rounded="xl"
                    class="p-5 hover:bg-primary/5 hover:border-primary/30 transition-all duration-300 transform hover:-translate-y-1"
                    :class="{
                      'bg-primary/5 border-primary': selectedAnswer === index,
                    }"
                  >
                    <div class="flex items-center">
                      <v-radio
                        v-model="selectedAnswer"
                        :value="index"
                        hide-details
                        density="compact"
                        color="primary"
                        class="mr-4"
                      ></v-radio>
                      <span class="text-gray-800 text-lg">{{ option }}</span>
                    </div>
                  </v-card>
                </div>
              </div>
            </div>
          </v-card-text>

          <!-- 导航按钮 -->
          <v-card-actions
            class="px-8 py-6 bg-gray-50 border-t border-gray-100 justify-end"
          >
            <v-btn
              @click="nextQuestion"
              :disabled="selectedAnswer === null"
              color="primary"
              variant="elevated"
              size="large"
              :elevation="selectedAnswer !== null ? 4 : 0"
            >
              {{
                currentQuestionIndex === quiz.questions.length - 1
                  ? "Submit quiz"
                  : "Next question"
              }}
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>

<script setup lang="ts">
/// <reference types="node" />
import { ref, onMounted, watch, computed, onUnmounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useQuery, useMutation } from "@vue/apollo-composable";
import { useAuthStore } from "../stores/authStore";
import { GET_QUIZ_SET } from "../graphql/quizQueries";
import { SUBMIT_ANSWERS } from "../graphql/quizMutations";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

// 状态管理
const quizId = parseInt(route.params.quizId as string, 10);
const loading = ref(true);
const errorMessage = ref("");
const currentQuestionIndex = ref(0);
const selectedAnswer = ref<number | null>(null);
const currentQuestionTime = ref(0);
const questionTimer = ref<NodeJS.Timeout | null>(null);
const totalTimeTaken = ref(0); // 记录整个测验的总用时（秒）
const totalTimer = ref<NodeJS.Timeout | null>(null);
const answers = ref<
  Array<{ questionId: string; selectedAnswers: number[]; timeTaken: number }>
>([]);

// 时间状态管理
const timeStatus = ref<"not_started" | "active" | "ended">("active");
const timeStatusMessage = ref("");
const timeCheckInterval = ref<NodeJS.Timeout | null>(null);

// 使用GraphQL查询获取问卷数据
const {
  result: quizData,
  error,
  refetch,
} = useQuery(GET_QUIZ_SET, {
  quizId: quizId,
});

// 计算属性
const quiz = computed(() => quizData.value?.quizSet || null);
const currentQuestion = computed(() => {
  return quiz.value?.questions[currentQuestionIndex.value];
});

// 格式化时间为 MM:SS
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
};

// 格式化日期时间
const formatDateTime = (timestampMs: string | number): string => {
  const date = new Date(parseInt(timestampMs as string));
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

// 检查测验时间状态
const checkQuizTimeStatus = () => {
  if (!quiz.value) return;

  const now = Date.now();
  const startTime = parseInt(quiz.value.startTime) / 1000;
  const endTime = parseInt(quiz.value.endTime) / 1000;

  if (now < startTime) {
    timeStatus.value = "not_started";
    timeStatusMessage.value = `Quiz will start at ${formatDateTime(startTime)}`;
    return false;
  } else if (now > endTime) {
    timeStatus.value = "ended";
    timeStatusMessage.value = `Quiz has ended, end time was ${formatDateTime(
      quiz.value.endTime
    )}`;
    return false;
  } else {
    timeStatus.value = "active";
    timeStatusMessage.value = "";
    return true;
  }
};

const showNotification = ref(false);
const notificationMessage = ref("");
const notificationType = ref("success");

const showToast = (message: string, isSuccess: boolean = true) => {
  notificationMessage.value = message;
  notificationType.value = isSuccess ? "success" : "error";
  showNotification.value = true;
  setTimeout(() => (showNotification.value = false), 3000);
};

const copyQuizLink = () => {
  const link = `${window.location.origin}/quiz/${quizId}`;
  navigator.clipboard
    .writeText(link)
    .then(() => {
      showToast("Quiz link copied to clipboard");
    })
    .catch((err) => {
      console.error("Failed to copy link: ", err);
      showToast("Failed to copy link: " + link, false);
    });
};

// 选择答案
const selectAnswer = (index: number) => {
  selectedAnswer.value = index;
};

// 下一题
const nextQuestion = () => {
  if (selectedAnswer.value === null) return;

  // 记录当前题目的答题时间和答案
  if (currentQuestion.value) {
    answers.value.push({
      questionId: currentQuestion.value.id,
      selectedAnswers: [selectedAnswer.value],
      timeTaken: currentQuestionTime.value,
    });
  }

  // 重置当前题目的状态
  selectedAnswer.value = null;
  currentQuestionTime.value = 0;

  // 如果是最后一题，提交答案
  if (currentQuestionIndex.value === quiz.value?.questions.length - 1) {
    submitQuiz();
    return;
  }

  // 否则进入下一题
  currentQuestionIndex.value++;
};

// 使用GraphQL变更提交问卷答案
const { mutate: submitAnswersMutation } = useMutation(SUBMIT_ANSWERS);

// 提交问卷
const submitQuiz = async () => {
  if (!authStore.currentUser) return;

  try {
    // 记录最后一题的答题时间和答案
    if (currentQuestion.value && selectedAnswer.value !== null) {
      answers.value.push({
        questionId: currentQuestion.value.id,
        selectedAnswers: [selectedAnswer.value],
        timeTaken: currentQuestionTime.value,
      });
    }

    // 清除所有计时器
    if (questionTimer.value) {
      clearInterval(questionTimer.value);
    }
    if (totalTimer.value) {
      clearInterval(totalTimer.value);
    }

    // 构建符合合约要求的提交参数
    const params = {
      quizId: quizId, // 使用 snake_case 与合约匹配
      answers: answers.value.map((item) => item.selectedAnswers), // 只传递答案数组
      timeTaken: totalTimeTaken.value * 1000, // 转换为毫秒
      nickName: authStore.currentUser.username || "QuizTaker",
    };

    // 提交答案
    await submitAnswersMutation({ field0: params });

    // 跳转到排名页面
    router.push(`/quiz-rank/${quizId}`);
  } catch (err) {
    errorMessage.value = "Submission failed, please try again later";
    console.error("Quiz submission error:", err);
  }
};

// 初始化问卷数据
const initQuizData = async () => {
  try {
    loading.value = true;
    authStore.initAuth();

    // 未登录用户重定向到登录页
    if (!authStore.isAuthenticated) {
      router.push(`/login?redirect=/quiz/${quizId}`);
      return;
    }

    // 重新获取数据
    await refetch();

    if (!quiz.value || quiz.value.questions.length === 0) {
      errorMessage.value = "Quiz does not exist or has no content";
      return;
    }
  } catch (err) {
    errorMessage.value = "Failed to load quiz, please try again later";
    console.error("Error loading quiz:", err);
  } finally {
    loading.value = false;
  }
};

// 监听当前题目变化，重置计时器
watch(
  currentQuestionIndex,
  () => {
    if (questionTimer.value) {
      clearInterval(questionTimer.value);
    }

    // 启动新的计时器
    questionTimer.value = setInterval(() => {
      currentQuestionTime.value++;
    }, 1000);
  },
  { immediate: true }
);

// 组件挂载时初始化
onMounted(() => {
  initQuizData();

  // 启动总计时器
  totalTimer.value = setInterval(() => {
    totalTimeTaken.value++;
  }, 1000) as unknown as NodeJS.Timeout;

  // 检查时间状态
  if (quiz.value) {
    checkQuizTimeStatus();
    // 设置定时器定期检查时间状态
    timeCheckInterval.value = setInterval(() => {
      const isActive = checkQuizTimeStatus();
      // 如果时间已过期且正在答题中，自动提交
      if (!isActive && currentQuestion.value) {
        submitQuiz();
      }
    }, 5000);
  }

  // 监听quiz数据变化
  watch(quiz, () => {
    if (quiz.value) {
      loading.value = false;
      checkQuizTimeStatus();
    }
  });

  // 处理错误
  watch(error, () => {
    if (error.value) {
      loading.value = false;
      errorMessage.value = "Failed to load quiz data, please try again later";
      console.error("Failed to load quiz:", error.value);
    }
  });
});

onUnmounted(() => {
  // 清理定时器
  if (questionTimer.value) clearInterval(questionTimer.value);
  if (totalTimer.value) clearInterval(totalTimer.value);
  if (timeCheckInterval.value) clearInterval(timeCheckInterval.value);
});

// Watch GraphQL data loading status
watch([loading, error], () => {
  if (loading.value === false) {
    if (error.value) {
      errorMessage.value =
        "Failed to load quiz: " + (error.value?.message || "Unknown error");
    }
  }
});
</script>
