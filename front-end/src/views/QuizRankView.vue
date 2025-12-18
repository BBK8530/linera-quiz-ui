<template>
  <div class="w-full max-w-4xl mx-auto">
    <v-card elevation="8" rounded="2xl" class="mb-6">
      <v-card-title
        class="bg-gradient-to-r from-primary to-primary/90 text-white py-6 px-8"
      >
        <div class="flex items-center justify-between w-full">
          <h1 class="text-2xl font-bold">{{ quizTitle }} Ranking</h1>
          <div class="text-white opacity-90">
            Participants: {{ participants }} | Average Score:
            {{ averageScore.toFixed(1) }}
          </div>
        </div>
      </v-card-title>
      <v-card-text class="px-8 mt-4">
        <v-text-field
          v-model="searchQuery"
          placeholder="search participants..."
          variant="outlined"
          density="compact"
          prepend-inner-icon="mdi-magnify"
          full-width
          hide-details
        ></v-text-field>
      </v-card-text>
    </v-card>

    <v-card elevation="8" rounded="2xl">
      <v-card-text class="p-0">
        <v-data-table
          :items="filteredQuizzes"
          :headers="headers"
          :items-per-page="itemsPerPage"
          :page="currentPage"
          :page-count="totalPages"
          hide-default-footer
          density="compact"
          class="elevation-0"
        >
          <template v-slot:body="{ items }">
            <tr
              v-for="submission in items"
              :key="submission.id"
              class="hover:bg-gray-50 transition-colors"
            >
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900">
                  {{ submission.rank }}
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">
                  {{ submission.userName }}
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div
                  class="text-sm font-semibold"
                  style="color: var(--v-success-base)"
                >
                  {{ submission.score }}
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-500">
                  {{ formatTime(submission.timeTaken) }}
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-500">
                  {{ formatDate(submission.completedAt) }}
                </div>
              </td>
            </tr>
            <tr v-if="items.length === 0">
              <td
                colspan="5"
                class="px-6 py-12 text-center text-sm text-gray-500"
              >
                No matching submission records found
              </td>
            </tr>
          </template>
        </v-data-table>

        <div class="flex justify-center mt-4 mb-6">
          <v-pagination
            v-model="currentPage"
            :length="totalPages"
            color="primary"
            density="compact"
          ></v-pagination>
        </div>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import { useQuery } from "@vue/apollo-composable";
import { GET_QUIZ_LEADERBOARD, GET_QUIZ_SET } from "../graphql/quizQueries";

// 响应式变量定义
const searchQuery = ref("");
const currentPage = ref(1);
const itemsPerPage = ref(10);
const quizTitle = ref("");

// 表头配置
const headers = [
  { title: "Rank", align: "start" as const, key: "rank" },
  { title: "User", align: "start" as const, key: "userName" },
  { title: "Score", align: "start" as const, key: "score" },
  { title: "Time Taken", align: "start" as const, key: "timeTaken" },
  { title: "Submission Time", align: "start" as const, key: "completedAt" },
];

// 监听currentPage变化，同步到计算属性
watch(
  () => currentPage.value,
  () => {
    // currentPage变化时自动更新filteredQuizzes
  }
);

// 路由
const route = useRoute();
const quizId = computed(() => parseInt(route.params.quizId as string, 10) || 0);

// 使用GraphQL查询获取问卷信息和排名数据
const { result: quizDataResult } = useQuery(GET_QUIZ_SET, {
  quizId: quizId.value,
});

const { result: leaderboardDataResult } = useQuery(GET_QUIZ_LEADERBOARD, {
  quizId: quizId.value,
});

// 简化数据访问
const quizData = quizDataResult;
const leaderboardData = leaderboardDataResult;

// 初始化数据
onMounted(() => {
  // 问卷标题会通过watch自动更新
});

// 监听路由参数变化，重新加载数据
watch(
  () => route.params.quizId,
  (newQuizId) => {
    if (newQuizId) {
      currentPage.value = 1; // 重置到第一页
    }
  }
);

// 监听问卷数据变化，更新标题
watch(
  () => quizData?.value?.quizSet,
  (quiz) => {
    if (quiz) {
      quizTitle.value = quiz.title;
    }
  }
);

// 排名数据计算属性
const rankedSubmissions = computed(() => {
  if (!leaderboardData.value?.quizLeaderboard) return [];

  // 转换排行榜数据格式以适配现有组件
  return leaderboardData.value.quizLeaderboard.map(
    (entry: any, index: number) => ({
      id: `${index}-${entry.user}`,
      userName: entry.user,
      score: entry.score,
      timeTaken: entry.timeTaken / 1000,
      completedAt: entry.completedAt / 1000,
      rank: index + 1,
    })
  );
});

// 搜索过滤
interface RankedSubmission {
  id: string;
  userName: string;
  score: number;
  timeTaken: number;
  completedAt: string;
  rank: number;
}

const filteredQuizzes = computed<RankedSubmission[]>(() => {
  const filtered = rankedSubmissions.value.filter(
    (submission: RankedSubmission) =>
      submission &&
      typeof submission.userName === "string" &&
      submission.userName
        .toLowerCase()
        .includes(searchQuery.value.toLowerCase())
  );

  // 分页处理
  const startIndex = (currentPage.value - 1) * itemsPerPage.value;
  return filtered.slice(startIndex, startIndex + itemsPerPage.value);
});

// 总页数计算
const totalPages = computed(() => {
  return Math.ceil(rankedSubmissions.value.length / itemsPerPage.value) || 1;
});

// 参与人数
const participants = computed(() => {
  return rankedSubmissions.value.length;
});

// 平均分数
const averageScore = computed(() => {
  if (rankedSubmissions.value.length === 0) return 0;
  const sum = rankedSubmissions.value.reduce(
    (acc: number, submission: RankedSubmission) => acc + submission.score,
    0
  );
  return sum / rankedSubmissions.value.length;
});

// 格式化日期
const formatDate = (dateString: string | Date) => {
  try {
    const date = new Date(dateString);
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch (error) {
    console.error("Failed to format date:", error);
    return "Invalid Date";
  }
};

// 格式化时间（秒转分秒）
const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m${secs}s`;
};
</script>
