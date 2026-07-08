import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import MarkdownView from "@/components/MarkdownView";
import LessonTips from "@/components/LessonTips";
import MarkLessonCompleteButton from "@/components/gamification/MarkLessonCompleteButton";
import { getDomain } from "@/lib/constants/domains";
import { getLesson } from "@/lib/content/registry";

interface Props {
  params: Promise<{ domain: string; lessonId: string }>;
}

export default async function LessonPage({ params }: Props) {
  const { domain: domainSlug, lessonId } = await params;
  const domain = getDomain(domainSlug);
  if (!domain) notFound();
  const lesson = getLesson(domain.id, lessonId);
  if (!lesson) notFound();

  return (
    <article>
      <PageHeader
        title={lesson.title}
        subtitle={`~${lesson.estMinutes} min read`}
        domain={domain}
        breadcrumbs={[
          { label: "Learn", href: "/learn" },
          { label: domain.shortName, href: `/learn/${domain.id}` },
          { label: lesson.title },
        ]}
      />
      <MarkdownView>{lesson.body}</MarkdownView>
      <LessonTips tips={lesson.tips} />
      <MarkLessonCompleteButton lessonId={lesson.id} />
    </article>
  );
}
