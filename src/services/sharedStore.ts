import type { App } from "obsidian";
import type KnowledgeWorkbenchPlugin from "../main";

/**
 * 共享数据存储：vault 根下 `00_工具/工作台数据.json`
 * 插件与 Web 端共用这一份数据（以后只维护一份）。
 * 结构为 { key: value }，与 Web 端 store.json 同构。
 */

export interface SharedStock {
  code: string;
  name: string;
  tag: string;
  status: string;
  driver: string;
  horizon: string;
  position: string;
  /** 入选理由 */
  reason?: string;
  /** 自定义标签 */
  label?: string;
}

export interface SharedTopic {
  title: string;
  status: string;
  tag: string;
}

export interface SharedWorkout {
  date: string;
  min: number;
}

export interface SharedTodo {
  text: string;
  done: boolean;
}

export interface SharedData {
  stockPool: SharedStock[];
  topicPool: SharedTopic[];
  workoutSessions: SharedWorkout[];
  quoteFavs: [string, string][];
  todayTodos: Record<string, SharedTodo[]>;
}

export function defaultSharedData(): SharedData {
  return {
    stockPool: [],
    topicPool: [],
    workoutSessions: [],
    quoteFavs: [],
    todayTodos: {},
  };
}

/** 共享数据文件路径（vault 根下，固定位置，不随 knowledgeBasePath 变化） */
export const SHARED_DATA_PATH = "00_工具/工作台数据.json";

/** 从 vault 读取共享数据（文件不存在或损坏时返回默认值） */
export async function loadSharedData(app: App): Promise<SharedData> {
  try {
    if (await app.vault.adapter.exists(SHARED_DATA_PATH)) {
      const raw = await app.vault.adapter.read(SHARED_DATA_PATH);
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return { ...defaultSharedData(), ...parsed };
      }
    }
  } catch (e) {
    console.error("[workbench] 读取共享数据失败", e);
  }
  return defaultSharedData();
}

/** 原子写共享数据（先写 tmp 再 replace，避免写坏文件） */
export async function saveSharedData(app: App, data: SharedData): Promise<void> {
  const json = JSON.stringify(data, null, 2);
  const tmp = SHARED_DATA_PATH + ".tmp";
  try {
    await app.vault.adapter.write(tmp, json);
    if (await app.vault.adapter.exists(SHARED_DATA_PATH)) {
      await app.vault.adapter.remove(SHARED_DATA_PATH);
    }
    await app.vault.adapter.write(SHARED_DATA_PATH, json);
    await app.vault.adapter.remove(tmp).catch(() => {});
  } catch (e) {
    console.error("[workbench] 写共享数据失败", e);
  }
}

/**
 * 一次性迁移：把插件旧 data.json 里的共享字段写入 vault 共享文件，
 * 并从 data.json 删除（去重，以后只维护共享文件一份）。
 */
export async function migrateSharedFromDataJson(
  app: App,
  plugin: KnowledgeWorkbenchPlugin
): Promise<void> {
  const shared = await loadSharedData(app);
  let raw: Record<string, unknown> | null = null;
  try {
    raw = (await plugin.loadData()) as Record<string, unknown> | null;
  } catch (e) {
    console.error("[workbench] 读取旧 data.json 失败", e);
  }

  const legacyKeys: (keyof SharedData)[] = [
    "stockPool",
    "topicPool",
    "workoutSessions",
    "quoteFavs",
    "todayTodos",
  ];
  let changed = false;

  if (raw) {
    for (const k of legacyKeys) {
      const v = raw[k];
      // 旧值非空且共享文件该项为空 → 迁移过去（去重优先共享文件）
      const sharedEmpty =
        Array.isArray(shared[k])
          ? (shared[k] as unknown[]).length === 0
          : typeof shared[k] === "object" && shared[k] !== null
            ? Object.keys(shared[k] as object).length === 0
            : true;
      if (v !== undefined && v !== null && sharedEmpty) {
        (shared as unknown as Record<string, unknown>)[k] = v;
        changed = true;
      }
      // 从 data.json 删除该冗余字段
      if (k in raw) {
        delete raw[k];
        changed = true;
      }
    }
  }

  if (changed) {
    await saveSharedData(app, shared);
    try {
      await plugin.saveData(raw || {});
    } catch (e) {
      console.error("[workbench] 清理旧 data.json 失败", e);
    }
  }
}
