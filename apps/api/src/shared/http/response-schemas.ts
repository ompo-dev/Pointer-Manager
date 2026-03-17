import { t } from "elysia";

const nullableString = t.Union([t.String(), t.Null()]);
const nullableNumber = t.Union([t.Number(), t.Null()]);

export const errorResponseSchema = t.Object({
  message: t.String(),
});

export const healthResponseSchema = t.Object({
  status: t.String(),
  service: t.String(),
});

export const authUserSchema = t.Object({
  id: t.String(),
  organizationId: t.String(),
  plantId: nullableString,
  name: t.String(),
  email: t.String(),
  role: t.String(),
  status: t.String(),
  modulePermissions: t.Array(t.String()),
});

export const loginResponseSchema = t.Object({
  token: t.String(),
  user: t.Object({
    id: t.String(),
    name: t.String(),
    email: t.String(),
    role: t.String(),
    plantId: nullableString,
  }),
});

export const accessUserSchema = t.Object({
  id: t.String(),
  name: t.String(),
  email: t.String(),
  role: t.String(),
  status: t.String(),
  plantId: nullableString,
  modulePermissions: t.Array(t.String()),
  lastLoginAt: t.Optional(nullableString),
  createdAt: t.Optional(t.String()),
});

export const authorizedNetworkSchema = t.Object({
  id: t.Optional(t.String()),
  name: t.String(),
  ssid: t.Optional(nullableString),
  bssid: t.Optional(nullableString),
  ipv4Cidr: t.Optional(nullableString),
  notes: t.Optional(nullableString),
});

export const detectedPlantNetworkCandidateSchema = t.Object({
  id: t.String(),
  label: t.String(),
  connectionKind: t.String(),
  interfaceName: nullableString,
  ipAddress: nullableString,
  suggestedIpv4Cidr: nullableString,
  ssid: nullableString,
  bssid: nullableString,
  source: t.String(),
  isCurrent: t.Boolean(),
  notes: nullableString,
});

const plantBaseProperties = {
  id: t.String(),
  code: t.String(),
  name: t.String(),
  city: t.String(),
  state: t.String(),
  timezone: t.String(),
  openingHour: t.String(),
  closingHour: t.String(),
  qrToken: t.String(),
  status: t.String(),
  requireWifiMatch: t.Boolean(),
  requireSelfie: t.Boolean(),
  autoCloseLimitHours: t.Number(),
  lateAlertMinutes: t.Number(),
  geofenceLatitude: t.Optional(nullableNumber),
  geofenceLongitude: t.Optional(nullableNumber),
  geofenceRadiusMeters: t.Optional(nullableNumber),
};

export const plantSchema = t.Object({
  ...plantBaseProperties,
  authorizedNetworks: t.Array(authorizedNetworkSchema),
  _count: t.Optional(
    t.Object({
      people: t.Number(),
      timeEntries: t.Number(),
    }),
  ),
});

export const detectedPlantNetworkSchema = t.Object({
  requestIp: nullableString,
  selectedCandidateId: nullableString,
  ipAddress: nullableString,
  suggestedIpv4Cidr: nullableString,
  interfaceName: nullableString,
  connectionKind: nullableString,
  ssid: nullableString,
  bssid: nullableString,
  source: nullableString,
  canAutoReadWifiIdentity: t.Boolean(),
  notes: t.String(),
  candidates: t.Array(detectedPlantNetworkCandidateSchema),
});

const plantPersonSchema = t.Object({
  id: t.String(),
  fullName: t.String(),
  cpf: t.String(),
  personType: t.String(),
});

export const plantDetailSchema = t.Object({
  ...plantBaseProperties,
  authorizedNetworks: t.Array(authorizedNetworkSchema),
  presentPeople: t.Array(
    t.Object({
      id: t.String(),
      openedAt: t.String(),
      person: t.Object({
        id: t.String(),
        personId: t.String(),
        fullName: t.String(),
        cpf: t.String(),
        personType: t.String(),
      }),
    }),
  ),
  history: t.Array(
    t.Object({
      id: t.String(),
      openedAt: t.String(),
      closedAt: t.Optional(nullableString),
      status: t.String(),
      totalMinutes: t.Optional(nullableNumber),
      person: t.Object({
        id: t.String(),
        personId: t.String(),
        fullName: t.String(),
        cpf: t.String(),
        personType: t.String(),
      }),
    }),
  ),
});

const personBaseProperties = {
  id: t.String(),
  fullName: t.String(),
  cpf: t.String(),
  personType: t.String(),
  employer: t.String(),
  jobTitle: t.String(),
  email: t.Optional(nullableString),
  phone: t.Optional(nullableString),
  photoUrl: t.Optional(nullableString),
  notes: t.Optional(nullableString),
  status: t.String(),
  homePlantId: t.Optional(nullableString),
  personId: t.String(),
};

export const personSchema = t.Object({
  ...personBaseProperties,
  homePlant: t.Optional(
    t.Union([
      t.Object({
        id: t.String(),
        name: t.String(),
      }),
      t.Null(),
    ]),
  ),
  _count: t.Optional(
    t.Object({
      timeEntries: t.Number(),
    }),
  ),
});

export const personDetailSchema = t.Object({
  ...personBaseProperties,
  homePlant: t.Optional(
    t.Union([
      t.Object({
        id: t.String(),
        name: t.String(),
      }),
      t.Null(),
    ]),
  ),
  history: t.Array(
    t.Object({
      id: t.String(),
      openedAt: t.String(),
      closedAt: t.Optional(nullableString),
      totalMinutes: t.Optional(nullableNumber),
      status: t.String(),
      plant: t.Object({
        id: t.String(),
        name: t.String(),
      }),
    }),
  ),
  totalMinutes: t.Number(),
});

export const accessPersonSchema = t.Object({
  id: t.String(),
  personId: t.String(),
  fullName: t.String(),
  cpf: t.String(),
  personType: t.String(),
  employer: t.String(),
  jobTitle: t.String(),
  status: t.String(),
});

export const accessRequiredFieldSchema = t.Object({
  name: t.String(),
  label: t.String(),
  placeholder: t.String(),
});

export const accessIntakeSchema = t.Object({
  plant: t.Object({
    id: t.String(),
    name: t.String(),
    city: t.String(),
    state: t.String(),
    requireWifiMatch: t.Boolean(),
    requireSelfie: t.Boolean(),
    requireGeolocation: t.Boolean(),
  }),
  person: t.Union([accessPersonSchema, t.Null()]),
  openEntry: t.Union([
    t.Object({
      id: t.String(),
      openedAt: t.String(),
      plantId: t.String(),
      plantName: t.String(),
      samePlant: t.Boolean(),
    }),
    t.Null(),
  ]),
  suggestedMode: t.String(),
  blockedReason: nullableString,
  personTypePolicies: t.Array(
    t.Object({
      personType: t.String(),
      label: t.String(),
      description: t.String(),
      requiredFields: t.Array(accessRequiredFieldSchema),
    }),
  ),
});

export const accessNetworkStatusSchema = t.Object({
  plant: t.Object({
    id: t.String(),
    name: t.String(),
    city: t.String(),
    state: t.String(),
    requireWifiMatch: t.Boolean(),
    requireSelfie: t.Boolean(),
    requireGeolocation: t.Boolean(),
  }),
  network: t.Object({
    status: t.String(),
    reason: t.String(),
    message: t.String(),
    observedIp: nullableString,
    currentNetworkName: nullableString,
    matched: t.Boolean(),
    matchedBy: t.Union([t.String(), t.Null()]),
    matchedNetworkName: nullableString,
    browserHintIgnored: t.Boolean(),
  }),
  location: t.Object({
    status: t.String(),
    reason: t.String(),
    message: t.String(),
    required: t.Boolean(),
    observedLatitude: nullableNumber,
    observedLongitude: nullableNumber,
    distanceMeters: nullableNumber,
    radiusMeters: nullableNumber,
  }),
  ready: t.Boolean(),
});

export const timeEntrySchema = t.Object({
  id: t.String(),
  openedAt: t.String(),
  closedAt: t.Optional(nullableString),
  totalMinutes: t.Optional(nullableNumber),
  elapsedMinutes: t.Number(),
  status: t.String(),
  origin: t.String(),
  deviceIp: t.Optional(nullableString),
  deviceLabel: t.Optional(nullableString),
  wifiSsid: t.Optional(nullableString),
  wifiBssid: t.Optional(nullableString),
  selfieUrl: t.Optional(nullableString),
  geoLatitude: t.Optional(nullableNumber),
  geoLongitude: t.Optional(nullableNumber),
  validationMode: t.Optional(nullableString),
  validationNotes: t.Optional(nullableString),
  notes: t.Optional(nullableString),
  closedReason: t.Optional(nullableString),
  person: t.Object({
    id: t.String(),
    personId: t.String(),
    fullName: t.String(),
    cpf: t.String(),
    personType: t.String(),
    employer: t.String(),
    jobTitle: t.String(),
  }),
  plant: t.Object({
    id: t.String(),
    name: t.String(),
    city: t.String(),
    state: t.String(),
  }),
  adjustedByUser: t.Optional(
    t.Union([
      t.Object({
        id: t.String(),
        name: t.String(),
        email: t.String(),
      }),
      t.Null(),
    ]),
  ),
});

export const dashboardOverviewSchema = t.Object({
  activePeople: t.Number(),
  openEntries: t.Number(),
  recordsToday: t.Number(),
  plantsWithActivityToday: t.Number(),
  peopleWithoutExit: t.Number(),
  hoursByPlantToday: t.Array(
    t.Object({
      plantId: t.String(),
      plantName: t.String(),
      totalMinutes: t.Number(),
      records: t.Number(),
    }),
  ),
  presenceRanking: t.Array(
    t.Object({
      plantId: t.String(),
      plantName: t.String(),
      totalMinutes: t.Number(),
      records: t.Number(),
    }),
  ),
  overtimeAlerts: t.Array(
    t.Object({
      id: t.String(),
      personName: t.String(),
      plantName: t.String(),
      minutesOpen: t.Number(),
    }),
  ),
  liveEntries: t.Array(
    t.Object({
      id: t.String(),
      personName: t.String(),
      personType: t.String(),
      plantName: t.String(),
      openedAt: t.String(),
      elapsedMinutes: t.Number(),
      status: t.String(),
    }),
  ),
});

export const reportsSummarySchema = t.Object({
  hoursByPerson: t.Array(
    t.Object({
      personId: t.String(),
      fullName: t.String(),
      cpf: t.String(),
      employer: t.String(),
      totalMinutes: t.Number(),
      records: t.Number(),
    }),
  ),
  hoursByPlant: t.Array(
    t.Object({
      plantId: t.String(),
      plantName: t.String(),
      totalMinutes: t.Number(),
      records: t.Number(),
    }),
  ),
  presence: t.Array(
    t.Object({
      personId: t.String(),
      fullName: t.String(),
      cpf: t.String(),
      presentDays: t.Number(),
      absences: t.Number(),
    }),
  ),
  overtime: t.Array(
    t.Object({
      entryId: t.String(),
      fullName: t.String(),
      plantName: t.String(),
      totalMinutes: t.Number(),
      extraMinutes: t.Number(),
    }),
  ),
});

export const autoCloseResponseSchema = t.Object({
  closedEntryIds: t.Array(t.String()),
});

export const auditLogSchema = t.Object({
  id: t.String(),
  action: t.String(),
  entity: t.String(),
  entityId: t.Optional(nullableString),
  ipAddress: t.Optional(nullableString),
  metadata: t.Optional(t.Union([t.Object({}, { additionalProperties: true }), t.Null()])),
  createdAt: t.String(),
  actorUser: t.Optional(
    t.Union([
      t.Object({
        id: t.String(),
        name: t.String(),
        email: t.String(),
        role: t.String(),
      }),
      t.Null(),
    ]),
  ),
});

export const commonErrorResponses = {
  401: errorResponseSchema,
  403: errorResponseSchema,
  404: errorResponseSchema,
  409: errorResponseSchema,
  422: errorResponseSchema,
  500: errorResponseSchema,
} as const;
