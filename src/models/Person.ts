export type PersonId = string;
export type PersonDateValue = string | null;
export type PersonSex = "female" | "male" | "nonbinary" | "unknown" | null;

export interface PersonInput {
  id?: PersonId;
  name: string;
  knownAs?: string | null;
  surname?: string | null;
  sex?: PersonSex;
  birthDate?: PersonDateValue | Date;
  birthPlace?: string | null;
  deathDate?: PersonDateValue | Date;
  deathPlace?: string | null;
  photo?: string | null;
  distinguishingMarks?: string | null;
  attachments?: string[] | null;
  notes?: string | null;
  profession?: string | null;
  instruction?: string | null;
  tags?: string[] | null;
  parentIds?: PersonId[];
  childIds?: PersonId[];
  partnerIds?: PersonId[];
  createdAt?: string;
  updatedAt?: string;
}

export interface PersonRecord {
  id: PersonId;
  name: string;
  knownAs: string | null;
  surname: string | null;
  sex: PersonSex;
  birthDate: PersonDateValue;
  birthPlace: string | null;
  deathDate: PersonDateValue;
  deathPlace: string | null;
  photo: string | null;
  distinguishingMarks: string | null;
  attachments: string[] | null;
  notes: string | null;
  profession: string | null;
  instruction: string | null;
  tags: string[] | null;
  parentIds: PersonId[];
  childIds: PersonId[];
  partnerIds: PersonId[];
  createdAt: string;
  updatedAt: string;
}

function normalizeText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeIdList(values: PersonId[] | null | undefined): PersonId[] {
  return Array.from(
    new Set(
      (values ?? [])
        .map((value) => value?.trim())
        .filter((value): value is PersonId => Boolean(value)),
    ),
  );
}

function normalizeStringList(values: string[] | null | undefined): string[] | null {
  const normalized = Array.from(
    new Set(
      (values ?? [])
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );
  return normalized.length > 0 ? normalized : null;
}

function normalizeDateValue(value: PersonDateValue | Date | undefined): PersonDateValue {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }

    return value.toISOString().slice(0, 10);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

export class Person {
  id: PersonId;
  name: string;
  knownAs: string | null;
  surname: string | null;
  sex: PersonSex;
  birthDate: PersonDateValue;
  birthPlace: string | null;
  deathDate: PersonDateValue;
  deathPlace: string | null;
  photo: string | null;
  distinguishingMarks: string | null;
  attachments: string[] | null;
  notes: string | null;
  profession: string | null;
  instruction: string | null;
  tags: string[] | null;
  parentIds: PersonId[];
  childIds: PersonId[];
  partnerIds: PersonId[];
  createdAt: string;
  updatedAt: string;

  constructor(input: PersonInput) {
    const now = new Date().toISOString();

    this.id = input.id?.trim() ?? "";
    this.name = input.name.trim();
    this.knownAs = normalizeText(input.knownAs);
    this.surname = normalizeText(input.surname);
    this.sex = input.sex ?? null;
    this.birthDate = normalizeDateValue(input.birthDate);
    this.birthPlace = normalizeText(input.birthPlace);
    this.deathDate = normalizeDateValue(input.deathDate);
    this.deathPlace = normalizeText(input.deathPlace);
    this.photo = normalizeText(input.photo);
    this.distinguishingMarks = normalizeText(input.distinguishingMarks);
    this.attachments = normalizeStringList(input.attachments);
    this.notes = normalizeText(input.notes);
    this.profession = normalizeText(input.profession);
    this.instruction = normalizeText(input.instruction);
    this.tags = normalizeStringList(input.tags);
    this.parentIds = normalizeIdList(input.parentIds);
    this.childIds = normalizeIdList(input.childIds);
    this.partnerIds = normalizeIdList(input.partnerIds);
    this.createdAt = input.createdAt ?? now;
    this.updatedAt = input.updatedAt ?? now;
  }

  get displayName(): string {
    return [this.name, this.surname].filter(Boolean).join(" ");
  }

  toRecord(): PersonRecord {
    return {
      id: this.id,
      name: this.name,
      knownAs: this.knownAs,
      surname: this.surname,
      sex: this.sex,
      birthDate: this.birthDate,
      birthPlace: this.birthPlace,
      deathDate: this.deathDate,
      deathPlace: this.deathPlace,
      photo: this.photo,
      distinguishingMarks: this.distinguishingMarks,
      attachments: this.attachments,
      notes: this.notes,
      profession: this.profession,
      instruction: this.instruction,
      tags: this.tags,
      parentIds: this.parentIds,
      childIds: this.childIds,
      partnerIds: this.partnerIds,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
