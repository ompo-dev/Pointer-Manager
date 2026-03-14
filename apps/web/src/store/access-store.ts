"use client";

import { create } from "zustand";
import {
  createAccessUser,
  fetchAccessUsers,
  updateAccessUser,
  type AccessUser,
} from "@/lib/api/access";
import { fetchPlants, type Plant } from "@/lib/api/plants";
import { createOptimisticId, resolveErrorMessage } from "@/store/store-utils";

export const defaultAccessPermissions = {
  SUPER_ADMIN: ["dashboard", "plants", "people", "time-entries", "reports", "access", "audit"],
  ADMIN: ["dashboard", "plants", "people", "time-entries", "reports", "audit"],
  PLANT_SUPERVISOR: ["dashboard", "plants", "people", "time-entries", "reports"],
} as const;

export interface AccessFormState {
  name: string;
  email: string;
  password: string;
  role: string;
  status: string;
  plantId: string;
  modulePermissionsRaw: string;
}

export const emptyAccessForm: AccessFormState = {
  name: "",
  email: "",
  password: "",
  role: "ADMIN",
  status: "ACTIVE",
  plantId: "",
  modulePermissionsRaw: defaultAccessPermissions.ADMIN.join(","),
};

function buildFormState(user?: AccessUser | null): AccessFormState {
  if (!user) {
    return emptyAccessForm;
  }

  return {
    name: user.name,
    email: user.email,
    password: "",
    role: user.role,
    status: user.status,
    plantId: user.plantId ?? "",
    modulePermissionsRaw:
      (user.modulePermissions ??
        defaultAccessPermissions[user.role as keyof typeof defaultAccessPermissions] ??
        []).join(", "),
  };
}

function parsePermissions(raw: string) {
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildOptimisticUser(id: string, form: AccessFormState, current?: AccessUser | null): AccessUser {
  return {
    id,
    name: form.name,
    email: form.email,
    role: form.role,
    status: form.status,
    plantId: form.plantId || null,
    modulePermissions: parsePermissions(form.modulePermissionsRaw),
    lastLoginAt: current?.lastLoginAt ?? null,
    createdAt: current?.createdAt ?? new Date().toISOString(),
  };
}

interface AccessStore {
  users: AccessUser[];
  plantOptions: Plant[];
  selectedUserId: string | null;
  form: AccessFormState;
  feedback: string | null;
  loadingUsers: boolean;
  loadingPlants: boolean;
  saving: boolean;
  loadUsers: () => Promise<void>;
  loadPlantOptions: () => Promise<void>;
  selectUser: (userId: string | null) => void;
  setFormValue: <K extends keyof AccessFormState>(key: K, value: AccessFormState[K]) => void;
  resetForm: () => void;
  clearFeedback: () => void;
  saveUser: () => Promise<void>;
}

export const useAccessStore = create<AccessStore>((set, get) => ({
  users: [],
  plantOptions: [],
  selectedUserId: null,
  form: emptyAccessForm,
  feedback: null,
  loadingUsers: false,
  loadingPlants: false,
  saving: false,
  async loadUsers() {
    set({ loadingUsers: true, feedback: null });

    try {
      const users = await fetchAccessUsers();
      set({ users, loadingUsers: false });
    } catch (error) {
      set({
        loadingUsers: false,
        feedback: resolveErrorMessage(error, "Falha ao carregar usuarios."),
      });
    }
  },
  async loadPlantOptions() {
    set({ loadingPlants: true });

    try {
      const plantOptions = await fetchPlants();
      set({ plantOptions, loadingPlants: false });
    } catch (error) {
      set({
        loadingPlants: false,
        feedback: resolveErrorMessage(error, "Falha ao carregar usinas."),
      });
    }
  },
  selectUser(selectedUserId) {
    const selectedUser = get().users.find((user) => user.id === selectedUserId) ?? null;

    set({
      selectedUserId,
      form: buildFormState(selectedUser),
      feedback: null,
    });
  },
  setFormValue(key, value) {
    set((state) => ({
      form: {
        ...state.form,
        [key]: value,
      },
    }));
  },
  resetForm() {
    set({
      selectedUserId: null,
      form: emptyAccessForm,
      feedback: null,
    });
  },
  clearFeedback() {
    set({ feedback: null });
  },
  async saveUser() {
    const { selectedUserId, form, users } = get();
    const currentUser = users.find((user) => user.id === selectedUserId) ?? null;
    const optimisticId = selectedUserId ?? createOptimisticId("access-user");
    const optimisticUser = buildOptimisticUser(optimisticId, form, currentUser);
    const previousUsers = users;

    set({
      saving: true,
      feedback: selectedUserId ? "Atualizando usuario..." : "Criando usuario...",
      users: selectedUserId
        ? users.map((user) => (user.id === optimisticId ? optimisticUser : user))
        : [optimisticUser, ...users],
      selectedUserId: optimisticId,
    });

    try {
      const payload = {
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        status: form.status,
        plantId: form.plantId || null,
        modulePermissions: parsePermissions(form.modulePermissionsRaw),
      };
      const savedUser = selectedUserId
        ? await updateAccessUser(selectedUserId, payload)
        : await createAccessUser(payload);

      set((state) => ({
        saving: false,
        feedback: "Usuario salvo com sucesso.",
        users: state.users.map((user) => (user.id === optimisticId ? savedUser : user)),
        selectedUserId: savedUser.id,
        form: buildFormState(savedUser),
      }));
    } catch (error) {
      set({
        saving: false,
        users: previousUsers,
        selectedUserId: currentUser?.id ?? null,
        form: buildFormState(currentUser),
        feedback: resolveErrorMessage(error, "Falha ao salvar usuario."),
      });
    }
  },
}));
