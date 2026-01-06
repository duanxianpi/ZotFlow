/**
 * AUTO-GENERATED ZOTERO TYPES
 * Source: schema.json (v39)
 */

import { ZoteroItemBase } from "./zotero-base";

export interface Annotation extends ZoteroItemBase {
  data: ZoteroItemBase["data"] & {
    itemType: "annotation";
  };
}

export interface Artwork extends ZoteroItemBase {
  data: ZoteroItemBase["data"] & {
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
  };
}

export interface Attachment extends ZoteroItemBase {
  data: ZoteroItemBase["data"] & {
    itemType: "attachment";
    title?: string;
    accessDate?: string;
    url?: string;
  };
}

export interface AudioRecording extends ZoteroItemBase {
  data: ZoteroItemBase["data"] & {
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
  };
}

export interface Bill extends ZoteroItemBase {
  data: ZoteroItemBase["data"] & {
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
  };
}

export interface BlogPost extends ZoteroItemBase {
  data: ZoteroItemBase["data"] & {
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
  };
}

export interface Book extends ZoteroItemBase {
  data: ZoteroItemBase["data"] & {
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
  };
}

export interface BookSection extends ZoteroItemBase {
  data: ZoteroItemBase["data"] & {
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
  };
}

export interface Case extends ZoteroItemBase {
  data: ZoteroItemBase["data"] & {
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
  };
}

export interface ComputerProgram extends ZoteroItemBase {
  data: ZoteroItemBase["data"] & {
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
  };
}

export interface ConferencePaper extends ZoteroItemBase {
  data: ZoteroItemBase["data"] & {
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
  };
}

export interface Dataset extends ZoteroItemBase {
  data: ZoteroItemBase["data"] & {
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
  };
}

export interface DictionaryEntry extends ZoteroItemBase {
  data: ZoteroItemBase["data"] & {
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
  };
}

export interface Document extends ZoteroItemBase {
  data: ZoteroItemBase["data"] & {
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
  };
}

export interface Email extends ZoteroItemBase {
  data: ZoteroItemBase["data"] & {
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
  };
}

export interface EncyclopediaArticle extends ZoteroItemBase {
  data: ZoteroItemBase["data"] & {
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
  };
}

export interface Film extends ZoteroItemBase {
  data: ZoteroItemBase["data"] & {
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
  };
}

export interface ForumPost extends ZoteroItemBase {
  data: ZoteroItemBase["data"] & {
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
  };
}

export interface Hearing extends ZoteroItemBase {
  data: ZoteroItemBase["data"] & {
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
  };
}

export interface InstantMessage extends ZoteroItemBase {
  data: ZoteroItemBase["data"] & {
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
  };
}

export interface Interview extends ZoteroItemBase {
  data: ZoteroItemBase["data"] & {
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
  };
}

export interface JournalArticle extends ZoteroItemBase {
  data: ZoteroItemBase["data"] & {
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
  };
}

export interface Letter extends ZoteroItemBase {
  data: ZoteroItemBase["data"] & {
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
  };
}

export interface MagazineArticle extends ZoteroItemBase {
  data: ZoteroItemBase["data"] & {
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
  };
}

export interface Manuscript extends ZoteroItemBase {
  data: ZoteroItemBase["data"] & {
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
  };
}

export interface Map extends ZoteroItemBase {
  data: ZoteroItemBase["data"] & {
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
  };
}

export interface NewspaperArticle extends ZoteroItemBase {
  data: ZoteroItemBase["data"] & {
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
  };
}

export interface Note extends ZoteroItemBase {
  data: ZoteroItemBase["data"] & {
    itemType: "note";
  };
}

export interface Patent extends ZoteroItemBase {
  data: ZoteroItemBase["data"] & {
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
  };
}

export interface Podcast extends ZoteroItemBase {
  data: ZoteroItemBase["data"] & {
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
  };
}

export interface Preprint extends ZoteroItemBase {
  data: ZoteroItemBase["data"] & {
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
  };
}

export interface Presentation extends ZoteroItemBase {
  data: ZoteroItemBase["data"] & {
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
  };
}

export interface RadioBroadcast extends ZoteroItemBase {
  data: ZoteroItemBase["data"] & {
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
  };
}

export interface Report extends ZoteroItemBase {
  data: ZoteroItemBase["data"] & {
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
  };
}

export interface Standard extends ZoteroItemBase {
  data: ZoteroItemBase["data"] & {
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
  };
}

export interface Statute extends ZoteroItemBase {
  data: ZoteroItemBase["data"] & {
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
  };
}

export interface Thesis extends ZoteroItemBase {
  data: ZoteroItemBase["data"] & {
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
  };
}

export interface TvBroadcast extends ZoteroItemBase {
  data: ZoteroItemBase["data"] & {
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
  };
}

export interface VideoRecording extends ZoteroItemBase {
  data: ZoteroItemBase["data"] & {
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
  };
}

export interface Webpage extends ZoteroItemBase {
  data: ZoteroItemBase["data"] & {
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
  };
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

export type ZoteroItem =
  | Annotation
  | Artwork
  | Attachment
  | AudioRecording
  | Bill
  | BlogPost
  | Book
  | BookSection
  | Case
  | ComputerProgram
  | ConferencePaper
  | Dataset
  | DictionaryEntry
  | Document
  | Email
  | EncyclopediaArticle
  | Film
  | ForumPost
  | Hearing
  | InstantMessage
  | Interview
  | JournalArticle
  | Letter
  | MagazineArticle
  | Manuscript
  | Map
  | NewspaperArticle
  | Note
  | Patent
  | Podcast
  | Preprint
  | Presentation
  | RadioBroadcast
  | Report
  | Standard
  | Statute
  | Thesis
  | TvBroadcast
  | VideoRecording
  | Webpage;

export type ZoteroItemType =
  | "annotation"
  | "artwork"
  | "attachment"
  | "audioRecording"
  | "bill"
  | "blogPost"
  | "book"
  | "bookSection"
  | "case"
  | "computerProgram"
  | "conferencePaper"
  | "dataset"
  | "dictionaryEntry"
  | "document"
  | "email"
  | "encyclopediaArticle"
  | "film"
  | "forumPost"
  | "hearing"
  | "instantMessage"
  | "interview"
  | "journalArticle"
  | "letter"
  | "magazineArticle"
  | "manuscript"
  | "map"
  | "newspaperArticle"
  | "note"
  | "patent"
  | "podcast"
  | "preprint"
  | "presentation"
  | "radioBroadcast"
  | "report"
  | "standard"
  | "statute"
  | "thesis"
  | "tvBroadcast"
  | "videoRecording"
  | "webpage";
