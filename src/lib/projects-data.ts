import {
  EXTENSAO_ESCOLAS_COVER,
  EXTENSAO_ESCOLAS_DETAIL_PATH,
  EXTENSAO_ESCOLAS_MEMBERS,
  EXTENSAO_ESCOLAS_SUMMARY,
  EXTENSAO_ESCOLAS_TITLE,
} from "@/lib/extensao-escolas-content";
import {
  IMPRESSAO_PROJETO_COVER,
  IMPRESSAO_PROJETO_DETAIL_PATH,
  IMPRESSAO_PROJETO_MEMBERS,
  IMPRESSAO_PROJETO_SUMMARY,
  IMPRESSAO_PROJETO_TITLE,
} from "@/lib/impressao-projeto-content";

export type ProjectMember = {
  name: string;
  photo: string;
};

export type ProjectLinkType = "github" | "instagram" | "external" | "mail";

export type ProjectLink = {
  type: ProjectLinkType;
  href: string;
  label: string;
};

export type Project = {
  title: string;
  summary: string;
  image: string;
  detailHref: string;
  members: ProjectMember[];
  links: ProjectLink[];
};

export const PROJECTS: Project[] = [
  {
    title: IMPRESSAO_PROJETO_TITLE,
    summary: IMPRESSAO_PROJETO_SUMMARY,
    image: IMPRESSAO_PROJETO_COVER,
    detailHref: IMPRESSAO_PROJETO_DETAIL_PATH,
    members: [...IMPRESSAO_PROJETO_MEMBERS],
    links: [],
  },
  {
    title: EXTENSAO_ESCOLAS_TITLE,
    summary: EXTENSAO_ESCOLAS_SUMMARY,
    image: EXTENSAO_ESCOLAS_COVER,
    detailHref: EXTENSAO_ESCOLAS_DETAIL_PATH,
    members: [...EXTENSAO_ESCOLAS_MEMBERS],
    links: [],
  },
];
