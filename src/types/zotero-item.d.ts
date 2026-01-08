/**
 * AUTO-GENERATED ZOTERO TYPES
 * Source: schema.json (v39)
 */

interface BaseZoteroItemData {
  key: string;
  version: number;
  itemType: string;
  parentItem: string;
  title?: string;
  collections?: string[];
  dateAdded: string;
  dateModified: string;
  tags: Array<{ tag: string; type?: number }>;
  relations: { [key: string]: string | string[] };
  deleted: boolean;
}

interface AnnotationData extends BaseZoteroItemData {
  itemType: "annotation";
}

interface ArtworkData extends BaseZoteroItemData {
  itemType: "artwork";
  title?: string;
  abstractNote?: string;
  artworkMedium?: string;
  artworkSize?: string;
  date?: string;
  eventPlace?: string;
  DOI?: string;
  citationKey?: string;
  url?: string;
  accessDate?: string;
  archive?: string;
  archiveLocation?: string;
  shortTitle?: string;
  language?: string;
  libraryCatalog?: string;
  callNumber?: string;
  rights?: string;
  extra?: string;
  creators?: Array<{
    creatorType: "artist" | "contributor";
    firstName?: string;
    lastName?: string;
    name?: string;
  }>;
}

interface AttachmentData extends BaseZoteroItemData {
  itemType: "attachment";
  title?: string;
  accessDate?: string;
  url?: string;
}

interface AudioRecordingData extends BaseZoteroItemData {
  itemType: "audioRecording";
  title?: string;
  abstractNote?: string;
  audioRecordingFormat?: string;
  seriesTitle?: string;
  volume?: string;
  numberOfVolumes?: string;
  label?: string;
  place?: string;
  date?: string;
  runningTime?: string;
  ISBN?: string;
  DOI?: string;
  citationKey?: string;
  url?: string;
  accessDate?: string;
  archive?: string;
  archiveLocation?: string;
  shortTitle?: string;
  language?: string;
  libraryCatalog?: string;
  callNumber?: string;
  rights?: string;
  extra?: string;
  creators?: Array<{
    creatorType:
      | "performer"
      | "originalCreator"
      | "composer"
      | "wordsBy"
      | "translator"
      | "contributor";
    firstName?: string;
    lastName?: string;
    name?: string;
  }>;
}

interface BillData extends BaseZoteroItemData {
  itemType: "bill";
  title?: string;
  abstractNote?: string;
  billNumber?: string;
  code?: string;
  codeVolume?: string;
  section?: string;
  codePages?: string;
  legislativeBody?: string;
  session?: string;
  history?: string;
  date?: string;
  DOI?: string;
  citationKey?: string;
  url?: string;
  accessDate?: string;
  shortTitle?: string;
  language?: string;
  rights?: string;
  extra?: string;
  creators?: Array<{
    creatorType: "sponsor" | "cosponsor" | "contributor";
    firstName?: string;
    lastName?: string;
    name?: string;
  }>;
}

interface BlogPostData extends BaseZoteroItemData {
  itemType: "blogPost";
  title?: string;
  abstractNote?: string;
  blogTitle?: string;
  websiteType?: string;
  date?: string;
  DOI?: string;
  citationKey?: string;
  url?: string;
  accessDate?: string;
  ISSN?: string;
  shortTitle?: string;
  language?: string;
  rights?: string;
  extra?: string;
  creators?: Array<{
    creatorType: "author" | "translator" | "commenter" | "contributor";
    firstName?: string;
    lastName?: string;
    name?: string;
  }>;
}

interface BookData extends BaseZoteroItemData {
  itemType: "book";
  title?: string;
  abstractNote?: string;
  series?: string;
  seriesNumber?: string;
  volume?: string;
  numberOfVolumes?: string;
  edition?: string;
  date?: string;
  publisher?: string;
  place?: string;
  originalDate?: string;
  originalPublisher?: string;
  originalPlace?: string;
  format?: string;
  numPages?: string;
  ISBN?: string;
  DOI?: string;
  citationKey?: string;
  url?: string;
  accessDate?: string;
  ISSN?: string;
  archive?: string;
  archiveLocation?: string;
  shortTitle?: string;
  language?: string;
  libraryCatalog?: string;
  callNumber?: string;
  rights?: string;
  extra?: string;
  creators?: Array<{
    creatorType:
      | "author"
      | "contributor"
      | "editor"
      | "translator"
      | "seriesEditor";
    firstName?: string;
    lastName?: string;
    name?: string;
  }>;
}

interface BookSectionData extends BaseZoteroItemData {
  itemType: "bookSection";
  title?: string;
  abstractNote?: string;
  bookTitle?: string;
  series?: string;
  seriesNumber?: string;
  volume?: string;
  numberOfVolumes?: string;
  edition?: string;
  date?: string;
  publisher?: string;
  place?: string;
  originalDate?: string;
  originalPublisher?: string;
  originalPlace?: string;
  format?: string;
  pages?: string;
  ISBN?: string;
  DOI?: string;
  citationKey?: string;
  url?: string;
  accessDate?: string;
  ISSN?: string;
  archive?: string;
  archiveLocation?: string;
  shortTitle?: string;
  language?: string;
  libraryCatalog?: string;
  callNumber?: string;
  rights?: string;
  extra?: string;
  creators?: Array<{
    creatorType:
      | "author"
      | "contributor"
      | "editor"
      | "bookAuthor"
      | "translator"
      | "seriesEditor";
    firstName?: string;
    lastName?: string;
    name?: string;
  }>;
}

interface CaseData extends BaseZoteroItemData {
  itemType: "case";
  caseName?: string;
  abstractNote?: string;
  court?: string;
  dateDecided?: string;
  docketNumber?: string;
  reporter?: string;
  reporterVolume?: string;
  firstPage?: string;
  history?: string;
  DOI?: string;
  citationKey?: string;
  url?: string;
  accessDate?: string;
  shortTitle?: string;
  language?: string;
  rights?: string;
  extra?: string;
  creators?: Array<{
    creatorType: "author" | "counsel" | "contributor";
    firstName?: string;
    lastName?: string;
    name?: string;
  }>;
}

interface ComputerProgramData extends BaseZoteroItemData {
  itemType: "computerProgram";
  title?: string;
  abstractNote?: string;
  seriesTitle?: string;
  versionNumber?: string;
  date?: string;
  system?: string;
  company?: string;
  place?: string;
  programmingLanguage?: string;
  rights?: string;
  citationKey?: string;
  url?: string;
  accessDate?: string;
  DOI?: string;
  ISBN?: string;
  archive?: string;
  archiveLocation?: string;
  libraryCatalog?: string;
  callNumber?: string;
  shortTitle?: string;
  extra?: string;
  creators?: Array<{
    creatorType: "programmer" | "contributor";
    firstName?: string;
    lastName?: string;
    name?: string;
  }>;
}

interface ConferencePaperData extends BaseZoteroItemData {
  itemType: "conferencePaper";
  title?: string;
  abstractNote?: string;
  proceedingsTitle?: string;
  conferenceName?: string;
  publisher?: string;
  place?: string;
  date?: string;
  volume?: string;
  pages?: string;
  series?: string;
  DOI?: string;
  ISBN?: string;
  citationKey?: string;
  url?: string;
  accessDate?: string;
  ISSN?: string;
  archive?: string;
  archiveLocation?: string;
  shortTitle?: string;
  language?: string;
  libraryCatalog?: string;
  callNumber?: string;
  rights?: string;
  extra?: string;
  creators?: Array<{
    creatorType:
      | "author"
      | "contributor"
      | "editor"
      | "translator"
      | "seriesEditor";
    firstName?: string;
    lastName?: string;
    name?: string;
  }>;
}

interface DatasetData extends BaseZoteroItemData {
  itemType: "dataset";
  title?: string;
  abstractNote?: string;
  identifier?: string;
  type?: string;
  versionNumber?: string;
  date?: string;
  repository?: string;
  repositoryLocation?: string;
  format?: string;
  DOI?: string;
  citationKey?: string;
  url?: string;
  accessDate?: string;
  archive?: string;
  archiveLocation?: string;
  shortTitle?: string;
  language?: string;
  libraryCatalog?: string;
  callNumber?: string;
  rights?: string;
  extra?: string;
  creators?: Array<{
    creatorType: "author" | "contributor";
    firstName?: string;
    lastName?: string;
    name?: string;
  }>;
}

interface DictionaryEntryData extends BaseZoteroItemData {
  itemType: "dictionaryEntry";
  title?: string;
  abstractNote?: string;
  dictionaryTitle?: string;
  series?: string;
  seriesNumber?: string;
  volume?: string;
  numberOfVolumes?: string;
  edition?: string;
  date?: string;
  publisher?: string;
  place?: string;
  pages?: string;
  ISBN?: string;
  DOI?: string;
  citationKey?: string;
  url?: string;
  accessDate?: string;
  archive?: string;
  archiveLocation?: string;
  shortTitle?: string;
  language?: string;
  libraryCatalog?: string;
  callNumber?: string;
  rights?: string;
  extra?: string;
  creators?: Array<{
    creatorType:
      | "author"
      | "contributor"
      | "editor"
      | "translator"
      | "seriesEditor";
    firstName?: string;
    lastName?: string;
    name?: string;
  }>;
}

interface DocumentData extends BaseZoteroItemData {
  itemType: "document";
  title?: string;
  abstractNote?: string;
  type?: string;
  date?: string;
  publisher?: string;
  place?: string;
  DOI?: string;
  citationKey?: string;
  url?: string;
  accessDate?: string;
  archive?: string;
  archiveLocation?: string;
  shortTitle?: string;
  language?: string;
  libraryCatalog?: string;
  callNumber?: string;
  rights?: string;
  extra?: string;
  creators?: Array<{
    creatorType:
      | "author"
      | "contributor"
      | "editor"
      | "translator"
      | "reviewedAuthor";
    firstName?: string;
    lastName?: string;
    name?: string;
  }>;
}

interface EmailData extends BaseZoteroItemData {
  itemType: "email";
  subject?: string;
  abstractNote?: string;
  date?: string;
  DOI?: string;
  citationKey?: string;
  url?: string;
  accessDate?: string;
  shortTitle?: string;
  language?: string;
  rights?: string;
  extra?: string;
  creators?: Array<{
    creatorType: "author" | "translator" | "contributor" | "recipient";
    firstName?: string;
    lastName?: string;
    name?: string;
  }>;
}

interface EncyclopediaArticleData extends BaseZoteroItemData {
  itemType: "encyclopediaArticle";
  title?: string;
  abstractNote?: string;
  encyclopediaTitle?: string;
  series?: string;
  seriesNumber?: string;
  volume?: string;
  numberOfVolumes?: string;
  edition?: string;
  date?: string;
  publisher?: string;
  place?: string;
  pages?: string;
  ISBN?: string;
  DOI?: string;
  citationKey?: string;
  url?: string;
  accessDate?: string;
  archive?: string;
  archiveLocation?: string;
  shortTitle?: string;
  language?: string;
  libraryCatalog?: string;
  callNumber?: string;
  rights?: string;
  extra?: string;
  creators?: Array<{
    creatorType:
      | "author"
      | "contributor"
      | "editor"
      | "translator"
      | "seriesEditor";
    firstName?: string;
    lastName?: string;
    name?: string;
  }>;
}

interface FilmData extends BaseZoteroItemData {
  itemType: "film";
  title?: string;
  abstractNote?: string;
  distributor?: string;
  place?: string;
  date?: string;
  genre?: string;
  videoRecordingFormat?: string;
  runningTime?: string;
  DOI?: string;
  citationKey?: string;
  url?: string;
  accessDate?: string;
  archive?: string;
  archiveLocation?: string;
  shortTitle?: string;
  language?: string;
  libraryCatalog?: string;
  callNumber?: string;
  rights?: string;
  extra?: string;
  creators?: Array<{
    creatorType:
      | "director"
      | "producer"
      | "scriptwriter"
      | "castMember"
      | "host"
      | "guest"
      | "narrator"
      | "translator"
      | "contributor";
    firstName?: string;
    lastName?: string;
    name?: string;
  }>;
}

interface ForumPostData extends BaseZoteroItemData {
  itemType: "forumPost";
  title?: string;
  abstractNote?: string;
  forumTitle?: string;
  postType?: string;
  date?: string;
  DOI?: string;
  citationKey?: string;
  url?: string;
  accessDate?: string;
  shortTitle?: string;
  language?: string;
  rights?: string;
  extra?: string;
  creators?: Array<{
    creatorType: "author" | "contributor";
    firstName?: string;
    lastName?: string;
    name?: string;
  }>;
}

interface HearingData extends BaseZoteroItemData {
  itemType: "hearing";
  title?: string;
  abstractNote?: string;
  committee?: string;
  publisher?: string;
  numberOfVolumes?: string;
  documentNumber?: string;
  pages?: string;
  legislativeBody?: string;
  session?: string;
  history?: string;
  date?: string;
  place?: string;
  DOI?: string;
  citationKey?: string;
  url?: string;
  accessDate?: string;
  shortTitle?: string;
  language?: string;
  rights?: string;
  extra?: string;
  creators?: Array<{
    creatorType: "contributor";
    firstName?: string;
    lastName?: string;
    name?: string;
  }>;
}

interface InstantMessageData extends BaseZoteroItemData {
  itemType: "instantMessage";
  title?: string;
  abstractNote?: string;
  date?: string;
  DOI?: string;
  citationKey?: string;
  url?: string;
  accessDate?: string;
  shortTitle?: string;
  language?: string;
  rights?: string;
  extra?: string;
  creators?: Array<{
    creatorType: "author" | "contributor" | "recipient";
    firstName?: string;
    lastName?: string;
    name?: string;
  }>;
}

interface InterviewData extends BaseZoteroItemData {
  itemType: "interview";
  title?: string;
  abstractNote?: string;
  interviewMedium?: string;
  date?: string;
  publisher?: string;
  place?: string;
  DOI?: string;
  citationKey?: string;
  url?: string;
  accessDate?: string;
  archive?: string;
  archiveLocation?: string;
  shortTitle?: string;
  language?: string;
  libraryCatalog?: string;
  callNumber?: string;
  rights?: string;
  extra?: string;
  creators?: Array<{
    creatorType: "interviewee" | "contributor" | "interviewer" | "translator";
    firstName?: string;
    lastName?: string;
    name?: string;
  }>;
}

interface JournalArticleData extends BaseZoteroItemData {
  itemType: "journalArticle";
  title?: string;
  abstractNote?: string;
  publicationTitle?: string;
  publisher?: string;
  place?: string;
  date?: string;
  volume?: string;
  issue?: string;
  section?: string;
  partNumber?: string;
  partTitle?: string;
  pages?: string;
  series?: string;
  seriesTitle?: string;
  seriesText?: string;
  journalAbbreviation?: string;
  DOI?: string;
  citationKey?: string;
  url?: string;
  accessDate?: string;
  PMID?: string;
  PMCID?: string;
  ISSN?: string;
  archive?: string;
  archiveLocation?: string;
  shortTitle?: string;
  language?: string;
  libraryCatalog?: string;
  callNumber?: string;
  rights?: string;
  extra?: string;
  creators?: Array<{
    creatorType:
      | "author"
      | "contributor"
      | "editor"
      | "translator"
      | "reviewedAuthor";
    firstName?: string;
    lastName?: string;
    name?: string;
  }>;
}

interface LetterData extends BaseZoteroItemData {
  itemType: "letter";
  title?: string;
  abstractNote?: string;
  letterType?: string;
  date?: string;
  eventPlace?: string;
  DOI?: string;
  citationKey?: string;
  url?: string;
  accessDate?: string;
  archive?: string;
  archiveLocation?: string;
  shortTitle?: string;
  language?: string;
  libraryCatalog?: string;
  callNumber?: string;
  rights?: string;
  extra?: string;
  creators?: Array<{
    creatorType: "author" | "recipient" | "contributor" | "translator";
    firstName?: string;
    lastName?: string;
    name?: string;
  }>;
}

interface MagazineArticleData extends BaseZoteroItemData {
  itemType: "magazineArticle";
  title?: string;
  abstractNote?: string;
  publicationTitle?: string;
  publisher?: string;
  place?: string;
  date?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  ISSN?: string;
  DOI?: string;
  citationKey?: string;
  url?: string;
  accessDate?: string;
  archive?: string;
  archiveLocation?: string;
  shortTitle?: string;
  language?: string;
  libraryCatalog?: string;
  callNumber?: string;
  rights?: string;
  extra?: string;
  creators?: Array<{
    creatorType: "author" | "contributor" | "translator" | "reviewedAuthor";
    firstName?: string;
    lastName?: string;
    name?: string;
  }>;
}

interface ManuscriptData extends BaseZoteroItemData {
  itemType: "manuscript";
  title?: string;
  abstractNote?: string;
  manuscriptType?: string;
  institution?: string;
  place?: string;
  date?: string;
  numPages?: string;
  number?: string;
  DOI?: string;
  citationKey?: string;
  url?: string;
  accessDate?: string;
  archive?: string;
  archiveLocation?: string;
  shortTitle?: string;
  language?: string;
  libraryCatalog?: string;
  callNumber?: string;
  rights?: string;
  extra?: string;
  creators?: Array<{
    creatorType: "author" | "contributor" | "translator";
    firstName?: string;
    lastName?: string;
    name?: string;
  }>;
}

interface MapData extends BaseZoteroItemData {
  itemType: "map";
  title?: string;
  abstractNote?: string;
  mapType?: string;
  scale?: string;
  seriesTitle?: string;
  edition?: string;
  publisher?: string;
  place?: string;
  date?: string;
  DOI?: string;
  ISBN?: string;
  citationKey?: string;
  url?: string;
  accessDate?: string;
  archive?: string;
  archiveLocation?: string;
  shortTitle?: string;
  language?: string;
  libraryCatalog?: string;
  callNumber?: string;
  rights?: string;
  extra?: string;
  creators?: Array<{
    creatorType: "cartographer" | "contributor" | "seriesEditor";
    firstName?: string;
    lastName?: string;
    name?: string;
  }>;
}

interface NewspaperArticleData extends BaseZoteroItemData {
  itemType: "newspaperArticle";
  title?: string;
  abstractNote?: string;
  publicationTitle?: string;
  publisher?: string;
  place?: string;
  date?: string;
  volume?: string;
  issue?: string;
  edition?: string;
  section?: string;
  pages?: string;
  ISSN?: string;
  DOI?: string;
  citationKey?: string;
  url?: string;
  accessDate?: string;
  archive?: string;
  archiveLocation?: string;
  shortTitle?: string;
  language?: string;
  libraryCatalog?: string;
  callNumber?: string;
  rights?: string;
  extra?: string;
  creators?: Array<{
    creatorType: "author" | "contributor" | "translator" | "reviewedAuthor";
    firstName?: string;
    lastName?: string;
    name?: string;
  }>;
}

interface NoteData extends BaseZoteroItemData {
  itemType: "note";
}

interface PatentData extends BaseZoteroItemData {
  itemType: "patent";
  title?: string;
  abstractNote?: string;
  place?: string;
  country?: string;
  assignee?: string;
  issuingAuthority?: string;
  patentNumber?: string;
  filingDate?: string;
  pages?: string;
  applicationNumber?: string;
  priorityNumbers?: string;
  issueDate?: string;
  priorityDate?: string;
  references?: string;
  legalStatus?: string;
  DOI?: string;
  citationKey?: string;
  url?: string;
  accessDate?: string;
  shortTitle?: string;
  language?: string;
  rights?: string;
  extra?: string;
  creators?: Array<{
    creatorType: "inventor" | "attorneyAgent" | "contributor";
    firstName?: string;
    lastName?: string;
    name?: string;
  }>;
}

interface PodcastData extends BaseZoteroItemData {
  itemType: "podcast";
  title?: string;
  abstractNote?: string;
  seriesTitle?: string;
  episodeNumber?: string;
  audioFileType?: string;
  date?: string;
  publisher?: string;
  place?: string;
  runningTime?: string;
  DOI?: string;
  citationKey?: string;
  url?: string;
  accessDate?: string;
  shortTitle?: string;
  language?: string;
  rights?: string;
  extra?: string;
  creators?: Array<{
    creatorType:
      | "podcaster"
      | "guest"
      | "producer"
      | "executiveProducer"
      | "seriesCreator"
      | "director"
      | "scriptwriter"
      | "castMember"
      | "translator"
      | "contributor";
    firstName?: string;
    lastName?: string;
    name?: string;
  }>;
}

interface PreprintData extends BaseZoteroItemData {
  itemType: "preprint";
  title?: string;
  abstractNote?: string;
  genre?: string;
  repository?: string;
  archiveID?: string;
  place?: string;
  date?: string;
  series?: string;
  seriesNumber?: string;
  DOI?: string;
  citationKey?: string;
  url?: string;
  accessDate?: string;
  archive?: string;
  archiveLocation?: string;
  shortTitle?: string;
  language?: string;
  libraryCatalog?: string;
  callNumber?: string;
  rights?: string;
  extra?: string;
  creators?: Array<{
    creatorType:
      | "author"
      | "contributor"
      | "editor"
      | "translator"
      | "reviewedAuthor";
    firstName?: string;
    lastName?: string;
    name?: string;
  }>;
}

interface PresentationData extends BaseZoteroItemData {
  itemType: "presentation";
  title?: string;
  abstractNote?: string;
  presentationType?: string;
  date?: string;
  meetingName?: string;
  place?: string;
  series?: string;
  sessionTitle?: string;
  DOI?: string;
  citationKey?: string;
  url?: string;
  accessDate?: string;
  shortTitle?: string;
  language?: string;
  rights?: string;
  extra?: string;
  creators?: Array<{
    creatorType:
      | "presenter"
      | "chair"
      | "organizer"
      | "contributor"
      | "translator";
    firstName?: string;
    lastName?: string;
    name?: string;
  }>;
}

interface RadioBroadcastData extends BaseZoteroItemData {
  itemType: "radioBroadcast";
  title?: string;
  abstractNote?: string;
  programTitle?: string;
  episodeNumber?: string;
  audioRecordingFormat?: string;
  network?: string;
  place?: string;
  date?: string;
  runningTime?: string;
  DOI?: string;
  citationKey?: string;
  url?: string;
  accessDate?: string;
  archive?: string;
  archiveLocation?: string;
  shortTitle?: string;
  language?: string;
  libraryCatalog?: string;
  callNumber?: string;
  rights?: string;
  extra?: string;
  creators?: Array<{
    creatorType:
      | "creator"
      | "host"
      | "guest"
      | "producer"
      | "executiveProducer"
      | "seriesCreator"
      | "director"
      | "scriptwriter"
      | "castMember"
      | "translator"
      | "contributor";
    firstName?: string;
    lastName?: string;
    name?: string;
  }>;
}

interface ReportData extends BaseZoteroItemData {
  itemType: "report";
  title?: string;
  abstractNote?: string;
  reportNumber?: string;
  reportType?: string;
  institution?: string;
  place?: string;
  date?: string;
  seriesTitle?: string;
  seriesNumber?: string;
  pages?: string;
  DOI?: string;
  ISBN?: string;
  citationKey?: string;
  url?: string;
  accessDate?: string;
  ISSN?: string;
  archive?: string;
  archiveLocation?: string;
  shortTitle?: string;
  language?: string;
  libraryCatalog?: string;
  callNumber?: string;
  rights?: string;
  extra?: string;
  creators?: Array<{
    creatorType:
      | "author"
      | "editor"
      | "contributor"
      | "translator"
      | "seriesEditor";
    firstName?: string;
    lastName?: string;
    name?: string;
  }>;
}

interface StandardData extends BaseZoteroItemData {
  itemType: "standard";
  title?: string;
  abstractNote?: string;
  organization?: string;
  committee?: string;
  type?: string;
  number?: string;
  versionNumber?: string;
  status?: string;
  date?: string;
  publisher?: string;
  place?: string;
  DOI?: string;
  citationKey?: string;
  url?: string;
  accessDate?: string;
  archive?: string;
  archiveLocation?: string;
  shortTitle?: string;
  numPages?: string;
  language?: string;
  libraryCatalog?: string;
  callNumber?: string;
  rights?: string;
  extra?: string;
  creators?: Array<{
    creatorType: "author" | "contributor";
    firstName?: string;
    lastName?: string;
    name?: string;
  }>;
}

interface StatuteData extends BaseZoteroItemData {
  itemType: "statute";
  nameOfAct?: string;
  abstractNote?: string;
  code?: string;
  codeNumber?: string;
  publicLawNumber?: string;
  dateEnacted?: string;
  pages?: string;
  section?: string;
  session?: string;
  history?: string;
  DOI?: string;
  citationKey?: string;
  url?: string;
  accessDate?: string;
  shortTitle?: string;
  language?: string;
  rights?: string;
  extra?: string;
  creators?: Array<{
    creatorType: "author" | "contributor";
    firstName?: string;
    lastName?: string;
    name?: string;
  }>;
}

interface ThesisData extends BaseZoteroItemData {
  itemType: "thesis";
  title?: string;
  abstractNote?: string;
  thesisType?: string;
  university?: string;
  place?: string;
  date?: string;
  series?: string;
  seriesNumber?: string;
  numPages?: string;
  DOI?: string;
  ISBN?: string;
  citationKey?: string;
  url?: string;
  accessDate?: string;
  ISSN?: string;
  archive?: string;
  archiveLocation?: string;
  shortTitle?: string;
  language?: string;
  libraryCatalog?: string;
  callNumber?: string;
  rights?: string;
  extra?: string;
  creators?: Array<{
    creatorType: "author" | "contributor";
    firstName?: string;
    lastName?: string;
    name?: string;
  }>;
}

interface TvBroadcastData extends BaseZoteroItemData {
  itemType: "tvBroadcast";
  title?: string;
  abstractNote?: string;
  programTitle?: string;
  episodeNumber?: string;
  videoRecordingFormat?: string;
  network?: string;
  place?: string;
  date?: string;
  runningTime?: string;
  DOI?: string;
  citationKey?: string;
  url?: string;
  accessDate?: string;
  archive?: string;
  archiveLocation?: string;
  shortTitle?: string;
  language?: string;
  libraryCatalog?: string;
  callNumber?: string;
  rights?: string;
  extra?: string;
  creators?: Array<{
    creatorType:
      | "director"
      | "producer"
      | "executiveProducer"
      | "seriesCreator"
      | "scriptwriter"
      | "castMember"
      | "host"
      | "guest"
      | "narrator"
      | "translator"
      | "contributor";
    firstName?: string;
    lastName?: string;
    name?: string;
  }>;
}

interface VideoRecordingData extends BaseZoteroItemData {
  itemType: "videoRecording";
  title?: string;
  abstractNote?: string;
  videoRecordingFormat?: string;
  seriesTitle?: string;
  volume?: string;
  numberOfVolumes?: string;
  studio?: string;
  place?: string;
  date?: string;
  runningTime?: string;
  ISBN?: string;
  DOI?: string;
  citationKey?: string;
  url?: string;
  accessDate?: string;
  archive?: string;
  archiveLocation?: string;
  shortTitle?: string;
  language?: string;
  libraryCatalog?: string;
  callNumber?: string;
  rights?: string;
  extra?: string;
  creators?: Array<{
    creatorType:
      | "creator"
      | "director"
      | "producer"
      | "scriptwriter"
      | "executiveProducer"
      | "castMember"
      | "host"
      | "guest"
      | "narrator"
      | "translator"
      | "contributor";
    firstName?: string;
    lastName?: string;
    name?: string;
  }>;
}

interface WebpageData extends BaseZoteroItemData {
  itemType: "webpage";
  title?: string;
  abstractNote?: string;
  websiteTitle?: string;
  websiteType?: string;
  date?: string;
  publisher?: string;
  place?: string;
  DOI?: string;
  citationKey?: string;
  url?: string;
  accessDate?: string;
  shortTitle?: string;
  language?: string;
  rights?: string;
  extra?: string;
  creators?: Array<{
    creatorType: "author" | "contributor" | "translator";
    firstName?: string;
    lastName?: string;
    name?: string;
  }>;
}

export interface ZoteroPrimaryCreatorTypes {
  artwork: "artist";
  audioRecording: "performer";
  bill: "sponsor";
  blogPost: "author";
  book: "author";
  bookSection: "author";
  case: "author";
  computerProgram: "programmer";
  conferencePaper: "author";
  dataset: "author";
  dictionaryEntry: "author";
  document: "author";
  email: "author";
  encyclopediaArticle: "author";
  film: "director";
  forumPost: "author";
  hearing: "contributor";
  instantMessage: "author";
  interview: "interviewee";
  journalArticle: "author";
  letter: "author";
  magazineArticle: "author";
  manuscript: "author";
  map: "cartographer";
  newspaperArticle: "author";
  patent: "inventor";
  podcast: "podcaster";
  preprint: "author";
  presentation: "presenter";
  radioBroadcast: "creator";
  report: "author";
  standard: "author";
  statute: "author";
  thesis: "author";
  tvBroadcast: "director";
  videoRecording: "creator";
  webpage: "author";
}

export type ZoteroItemData =
  | AnnotationData
  | ArtworkData
  | AttachmentData
  | AudioRecordingData
  | BillData
  | BlogPostData
  | BookData
  | BookSectionData
  | CaseData
  | ComputerProgramData
  | ConferencePaperData
  | DatasetData
  | DictionaryEntryData
  | DocumentData
  | EmailData
  | EncyclopediaArticleData
  | FilmData
  | ForumPostData
  | HearingData
  | InstantMessageData
  | InterviewData
  | JournalArticleData
  | LetterData
  | MagazineArticleData
  | ManuscriptData
  | MapData
  | NewspaperArticleData
  | NoteData
  | PatentData
  | PodcastData
  | PreprintData
  | PresentationData
  | RadioBroadcastData
  | ReportData
  | StandardData
  | StatuteData
  | ThesisData
  | TvBroadcastData
  | VideoRecordingData
  | WebpageData;

export interface ZoteroItemDataTypeMap {
  annotation: AnnotationData;
  artwork: ArtworkData;
  attachment: AttachmentData;
  audioRecording: AudioRecordingData;
  bill: BillData;
  blogPost: BlogPostData;
  book: BookData;
  bookSection: BookSectionData;
  case: CaseData;
  computerProgram: ComputerProgramData;
  conferencePaper: ConferencePaperData;
  dataset: DatasetData;
  dictionaryEntry: DictionaryEntryData;
  document: DocumentData;
  email: EmailData;
  encyclopediaArticle: EncyclopediaArticleData;
  film: FilmData;
  forumPost: ForumPostData;
  hearing: HearingData;
  instantMessage: InstantMessageData;
  interview: InterviewData;
  journalArticle: JournalArticleData;
  letter: LetterData;
  magazineArticle: MagazineArticleData;
  manuscript: ManuscriptData;
  map: MapData;
  newspaperArticle: NewspaperArticleData;
  note: NoteData;
  patent: PatentData;
  podcast: PodcastData;
  preprint: PreprintData;
  presentation: PresentationData;
  radioBroadcast: RadioBroadcastData;
  report: ReportData;
  standard: StandardData;
  statute: StatuteData;
  thesis: ThesisData;
  tvBroadcast: TvBroadcastData;
  videoRecording: VideoRecordingData;
  webpage: WebpageData;
}
