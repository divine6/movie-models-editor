import { defineStore } from "pinia";

import { KEEP_ALIVE_STORAGE_KEY } from "@/constants";
import { KeepAliveState } from "@/stores/interface";

export const useKeepAliveStore = defineStore(KEEP_ALIVE_STORAGE_KEY, {
  state: (): KeepAliveState => ({
    keepAliveName: []
  }),
  actions: {
    // Add KeepAliveName
    async addKeepAliveName(name: string) {
      !this.keepAliveName.includes(name) && this.keepAliveName.push(name);
    },
    // Remove KeepAliveName
    async removeKeepAliveName(name: string) {
      this.keepAliveName = this.keepAliveName.filter(item => item !== name);
    },
    // Set KeepAliveName
    async setKeepAliveName(keepAliveName: string[] = []) {
      this.keepAliveName = keepAliveName;
    }
  }
});
