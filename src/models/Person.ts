export class Person {
  name: string;
  knownAs: string | null;
  surname: string | null;
  sex: string | null;
  birthDate: Date | null;
  birthPlace: string | null;
  deathDate: Date | null;
  deathPlace: string | null;
  photo: string | null;
  distinguishingMarks: string | null;
  attachments: string[] | null;
  notes: string | null;
  profession: string | null;
  instruction: string | null;
  tags: string[] | null;

  parentIds: number[];
  childIds: number[];

  constructor(
    name: string,
    knownAs: string | null = null,
    surname: string | null = null,
    sex: string | null = null,
    birthDate: Date | null = null,
    birthPlace: string | null = null,
    deathDate: Date | null = null,
    deathPlace: string | null = null,
    photo: string | null = null,
    distinguishingMarks: string | null = null,
    attachments: string[] | null = null,
    notes: string | null = null,
    profession: string | null = null,
    instruction: string | null = null,
    tags: string[] | null = null,
    parentIds: number[] = [],
    childIds: number[] = []
  ) {
    this.name = name;
    this.knownAs = knownAs;
    this.surname = surname;
    this.sex = sex;
    this.birthDate = birthDate;
    this.birthPlace = birthPlace;
    this.deathDate = deathDate;
    this.deathPlace = deathPlace;
    this.photo = photo;
    this.distinguishingMarks = distinguishingMarks;
    this.attachments = attachments;
    this.notes = notes;
    this.profession = profession;
    this.instruction = instruction;
    this.tags = tags;
    this.parentIds = parentIds;
    this.childIds = childIds;
  }
}