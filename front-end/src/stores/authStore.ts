import { defineStore } from 'pinia';

import { v4 as uuidv4 } from 'uuid';
interface User {
    id: string;
    username: string;
    email: string;
    createdAt?: Date;
}

export const useAuthStore = defineStore('auth', {
    state: () => ({
        currentUser: null as User | null,
        isAuthenticated: false,
    }),
    actions: {
        // 模拟登录
        async login(username: string) {
            // 模拟登录 API 调用
            try {
                // 模拟网络延迟
                await new Promise((resolve) => setTimeout(resolve, 800));

                // 创建用户对象
                const newUser = {
                    id: uuidv4(),
                    username,
                    email: `${username}@example.com`,
                    createdAt: new Date(),
                };

                // 更新状态
                this.currentUser = newUser;
                this.isAuthenticated = true;

                // 保存到本地存储
                localStorage.setItem('currentUser', JSON.stringify(newUser));

                return newUser;
            } catch (error) {
                throw error;
            }
        },
        // 登出
        logout() {
            this.currentUser = null;
            this.isAuthenticated = false;
            localStorage.removeItem('currentUser');
        },
        // 初始化时从localStorage加载用户
        initAuth() {
            const savedUser = localStorage.getItem('currentUser');
            if (savedUser) {
                this.currentUser = JSON.parse(savedUser);
                this.isAuthenticated = true;
            }
        },
    },
});
