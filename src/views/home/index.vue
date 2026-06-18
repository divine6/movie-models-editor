<template>
  <div />
</template>

<script setup lang="ts" name="homeIndex">
import { useRouter } from "vue-router";

const router = useRouter();
router.replace("/project/editor");
</script>
