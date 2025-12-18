<script setup>
import { provide, ref, onMounted, onUnmounted, watch } from "vue";
import { InMemoryWallet } from "@linera/client";

import Web3 from "web3";

// 创建钱包上下文
const walletContext = {
  account: ref(null),
  isConnected: ref(false),
  chainId: ref(null),
  walletType: ref(null),
  isLoading: ref(false),
  error: ref(null),
  connectWallet: null,
  disconnectWallet: null,
};

// 提供上下文供应用使用
provide("wallet", walletContext);

// 内部状态
const wallet = ref(null);

const reconnectTimeout = ref(null);

// 格式化账户地址
const getFormattedAccount = (account) => {
  if (!account) return null;
  return account.startsWith("0x") ? account : `0x${account}`;
};

// 连接钱包
const connectWallet = async () => {
  walletContext.isLoading.value = true;
  walletContext.error.value = null;

  try {
    // 生成随机InMemoryWallet
    wallet.value = new InMemoryWallet();
    const account = await wallet.value.getAccounts();
    const formattedAccount = getFormattedAccount(account[0]);

    walletContext.account.value = formattedAccount;
    walletContext.chainId.value = "local-test";
    walletContext.walletType.value = "in-memory";
    walletContext.isConnected.value = true;

    console.log("Randomly generated wallet:", formattedAccount);

    console.log(
      `Wallet connected: in-memory, Account: ${walletContext.account.value}`
    );
  } catch (error) {
    walletContext.error.value = error.message || "Failed to connect wallet";
    console.error("Wallet connection error:", error);
  } finally {
    walletContext.isLoading.value = false;
  }
};

// 断开钱包连接
const disconnectWallet = () => {
  walletContext.account.value = null;
  walletContext.isConnected.value = false;
  walletContext.chainId.value = null;
  walletContext.walletType.value = null;
  wallet.value = null;
};

// 暴露方法
walletContext.connectWallet = connectWallet;
walletContext.disconnectWallet = disconnectWallet;

// 组件挂载时自动连接钱包
onMounted(() => {
  // 自动生成并连接钱包
  connectWallet().catch((err) => {
    console.error("Failed to auto-connect wallet:", err);
  });
});

// 组件卸载时清理
onUnmounted(() => {
  if (reconnectTimeout.value) clearTimeout(reconnectTimeout.value);
});

// 提供wallet实例访问
provide("lineraWallet", wallet);
</script>

<template>
  <!-- 钱包提供器不需要渲染内容，仅提供上下文 -->
  <slot />
</template>
