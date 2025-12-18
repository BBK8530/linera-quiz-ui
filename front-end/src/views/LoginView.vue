<template>
  <v-app>
    <v-container fluid class="d-flex items-center justify-center h-screen">
      <v-card class="max-w-md w-full elevation-8 rounded-2xl">
        <!-- 头部 -->
        <v-card-title
          class="bg-gradient-to-r from-primary to-primary/90 text-white text-center py-6 px-8"
          title-level="h2"
        >
          Set Username
        </v-card-title>

        <!-- 表单内容 -->
        <v-card-text class="p-8">
          <v-form @submit.prevent="handleLogin">
            <div class="d-flex justify-center w-100">
              <v-text-field
                v-model="username"
                label="Username"
                variant="outlined"
                density="compact"
                required
                placeholder="Enter username"
                prepend-inner-icon="mdi-account"
                class="mb-4 mx-auto max-w-xs"
              ></v-text-field>
            </div>
            <v-alert
              v-if="errorMessage"
              type="error"
              variant="tonal"
              class="mt-4"
              density="compact"
            >
              {{ errorMessage }}
            </v-alert>
            <v-btn
              type="submit"
              :loading="isLoading"
              block
              variant="elevated"
              color="primary"
              size="large"
              class="mt-6"
            >
              Confirm
            </v-btn>
          </v-form>
        </v-card-text>
      </v-card>
    </v-container>
  </v-app>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/authStore";

const username = ref("");
const errorMessage = ref("");
const router = useRouter();
const authStore = useAuthStore();
const isLoading = ref(false);
const handleLogin = async () => {
  errorMessage.value = "";
  if (!username.value) {
    errorMessage.value = "Please enter a username";
    return;
  }
  try {
    const success = await authStore.login(username.value);
    if (success) {
      router.push("/");
    } else {
      errorMessage.value = "Username does not exist or system error";
    }
  } catch (err) {
    errorMessage.value = "Failed to set, please try again later";
    console.error("Login error:", err);
  } finally {
    isLoading.value = false;
  }
};
</script>

<style>
body {
  margin: 0;
}
</style>
