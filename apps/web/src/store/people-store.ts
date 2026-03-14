"use client";

import { create } from "zustand";
import {
  createPerson,
  fetchPeople,
  fetchPerson,
  updatePerson,
  type Person,
  type PersonDetails,
} from "@/lib/api/people";
import { fetchPlants, type Plant } from "@/lib/api/plants";
import { createOptimisticId, resolveErrorMessage } from "@/store/store-utils";

export interface PersonFormState {
  id?: string;
  fullName: string;
  cpf: string;
  personType: string;
  employer: string;
  jobTitle: string;
  email: string;
  phone: string;
  photoUrl: string;
  notes: string;
  status: string;
  primaryPlantId: string;
}

export const emptyPersonForm: PersonFormState = {
  fullName: "",
  cpf: "",
  personType: "EMPLOYEE",
  employer: "",
  jobTitle: "",
  email: "",
  phone: "",
  photoUrl: "",
  notes: "",
  status: "ACTIVE",
  primaryPlantId: "",
};

function buildPersonFormState(person?: PersonDetails | Person | null): PersonFormState {
  if (!person) {
    return emptyPersonForm;
  }

  return {
    id: person.id,
    fullName: person.fullName,
    cpf: person.cpf,
    personType: person.personType,
    employer: person.employer,
    jobTitle: person.jobTitle,
    email: person.email ?? "",
    phone: person.phone ?? "",
    photoUrl: person.photoUrl ?? "",
    notes: person.notes ?? "",
    status: person.status,
    primaryPlantId: person.primaryPlantId ?? "",
  };
}

function buildPersonPayload(form: PersonFormState) {
  return {
    fullName: form.fullName,
    cpf: form.cpf,
    personType: form.personType,
    employer: form.employer,
    jobTitle: form.jobTitle,
    email: form.email || null,
    phone: form.phone || null,
    photoUrl: form.photoUrl || null,
    notes: form.notes || null,
    status: form.status,
    primaryPlantId: form.primaryPlantId || null,
  };
}

function buildOptimisticPerson(form: PersonFormState, id: string, current?: Person | PersonDetails | null): Person {
  return {
    id,
    fullName: form.fullName,
    cpf: form.cpf,
    personType: form.personType,
    employer: form.employer,
    jobTitle: form.jobTitle,
    email: form.email || null,
    phone: form.phone || null,
    photoUrl: form.photoUrl || null,
    notes: form.notes || null,
    status: form.status,
    primaryPlantId: form.primaryPlantId || null,
    primaryPlant: current?.primaryPlant ?? null,
    _count: current?._count ?? {
      timeEntries: 0,
    },
  };
}

interface PeopleStore {
  people: Person[];
  plantOptions: Plant[];
  selectedPersonId: string | null;
  selectedPerson: PersonDetails | null;
  form: PersonFormState;
  feedback: string | null;
  loadingList: boolean;
  loadingDetail: boolean;
  loadingPlantOptions: boolean;
  saving: boolean;
  loadPeople: (filters: {
    search?: string;
    status?: string;
    personType?: string;
    plantId?: string;
  }) => Promise<void>;
  loadPlantOptions: () => Promise<void>;
  loadPerson: (personId: string | null) => Promise<void>;
  setSelectedPersonId: (personId: string | null) => void;
  setFormValue: <K extends keyof PersonFormState>(key: K, value: PersonFormState[K]) => void;
  resetForm: () => void;
  clearFeedback: () => void;
  savePerson: () => Promise<string | null>;
}

export const usePeopleStore = create<PeopleStore>((set, get) => ({
  people: [],
  plantOptions: [],
  selectedPersonId: null,
  selectedPerson: null,
  form: emptyPersonForm,
  feedback: null,
  loadingList: false,
  loadingDetail: false,
  loadingPlantOptions: false,
  saving: false,
  async loadPeople(filters) {
    set({ loadingList: true, feedback: null });

    try {
      const people = await fetchPeople(filters);
      set({ people, loadingList: false });
    } catch (error) {
      set({
        loadingList: false,
        feedback: resolveErrorMessage(error, "Nao foi possivel carregar as pessoas."),
      });
    }
  },
  async loadPlantOptions() {
    set({ loadingPlantOptions: true, feedback: null });

    try {
      const plantOptions = await fetchPlants();
      set({ plantOptions, loadingPlantOptions: false });
    } catch (error) {
      set({
        loadingPlantOptions: false,
        feedback: resolveErrorMessage(error, "Nao foi possivel carregar as usinas."),
      });
    }
  },
  async loadPerson(personId) {
    if (!personId) {
      set({
        selectedPersonId: null,
        selectedPerson: null,
        form: emptyPersonForm,
      });
      return;
    }

    set({ loadingDetail: true, selectedPersonId: personId, feedback: null });

    try {
      const selectedPerson = await fetchPerson(personId);
      set({
        selectedPerson,
        form: buildPersonFormState(selectedPerson),
        loadingDetail: false,
      });
    } catch (error) {
      set({
        loadingDetail: false,
        feedback: resolveErrorMessage(error, "Nao foi possivel carregar a pessoa."),
      });
    }
  },
  setSelectedPersonId(selectedPersonId) {
    set({ selectedPersonId });
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
      selectedPersonId: null,
      selectedPerson: null,
      form: emptyPersonForm,
      feedback: null,
    });
  },
  clearFeedback() {
    set({ feedback: null });
  },
  async savePerson() {
    const { form, people, selectedPerson } = get();
    const payload = buildPersonPayload(form);
    const optimisticId = form.id ?? createOptimisticId("person");
    const optimisticPerson = buildOptimisticPerson(form, optimisticId, selectedPerson);
    const previousPeople = people;
    const previousSelectedPerson = selectedPerson;

    set({
      saving: true,
      feedback: form.id ? "Atualizando pessoa..." : "Criando pessoa...",
      people: form.id
        ? people.map((item) => (item.id === form.id ? optimisticPerson : item))
        : [optimisticPerson, ...people],
      selectedPersonId: optimisticId,
      selectedPerson: {
        ...optimisticPerson,
        history: previousSelectedPerson?.history ?? [],
        totalMinutes: previousSelectedPerson?.totalMinutes ?? 0,
      },
      form: {
        ...form,
        id: optimisticId,
      },
    });

    try {
      const savedPerson = form.id
        ? await updatePerson(form.id, payload)
        : await createPerson(payload as never);

      set((state) => ({
        saving: false,
        feedback: "Pessoa salva com sucesso.",
        people: state.people.map((item) => (item.id === optimisticId ? savedPerson : item)),
        selectedPersonId: savedPerson.id,
        selectedPerson: state.selectedPerson?.id === optimisticId
          ? {
              ...state.selectedPerson,
              ...savedPerson,
            }
          : null,
        form: buildPersonFormState(savedPerson),
      }));

      return savedPerson.id;
    } catch (error) {
      set({
        saving: false,
        people: previousPeople,
        selectedPerson: previousSelectedPerson,
        selectedPersonId: previousSelectedPerson?.id ?? null,
        form: buildPersonFormState(previousSelectedPerson),
        feedback: resolveErrorMessage(error, "Nao foi possivel salvar a pessoa."),
      });

      return null;
    }
  },
}));
