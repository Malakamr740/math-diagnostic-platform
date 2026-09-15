import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import TaxonomyTree from '../components/report/TaxonomyTree';
import QuestionReviewCard from '../components/report/QuestionReviewCard';
import type { ReportData, TaxonomyType } from '../components/report/Types';

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

export default function ReportPage() {
  const { attemptId } = useParams();
  const [searchParams] = useSearchParams();
  const resumeToken = searchParams.get('token');
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<{ type: TaxonomyType; label: string } | null>(null);
  const questionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      if (!attemptId || !resumeToken) {
        setErrorMessage('This diagnostic link is missing required authentication tokens.');
        setLoading(false);
        return;
      }
      const { data, error } = await supabase.rpc('get_attempt_report', {
        p_attempt_id: attemptId,
        p_resume_token: resumeToken,
      });
      if (error || !data) {
        setErrorMessage(
          error?.message?.includes('not yet available')
            ? 'Your diagnostic assessment results are currently compiling. Please refresh.'
            : 'Diagnostic report not found or expired.'
        );
        setLoading(false);
        return;
      }
      setReport(data as ReportData);
      setLoading(false);
    }
    load();
  }, [attemptId, resumeToken]);

  const derived = useMemo(() => {
    if (!report) return null;
    const { student_info, overall, breakdowns } = report;
    const studentName =
      (student_info.registration_responses.full_name as string) ||
      (student_info.registration_responses.name as string) ||
      'Candidate';
    return {
      studentName,
      completedLabel: student_info.completed_at
        ? new Date(student_info.completed_at).toLocaleDateString()
        : 'Today',
      durationLabel: formatTime(student_info.total_time_seconds),
      avgTime: overall.avg_time_per_question,
      conceptual: Math.max(0, overall.incorrect_count - overall.rushed_mistakes_count - overall.timesink_mistakes_count),
      strongSkills: breakdowns.filter((b) => b.type === 'skill' && b.classification === 'strong'),
      weakSkills: breakdowns.filter((b) => b.type === 'skill' && b.classification === 'weak'),
    };
  }, [report]);

  const visibleQuestions = useMemo(() => {
    if (!report) return [];
    if (!filter) return report.questions;
    return report.questions.filter((q) => {
      switch (filter.type) {
        case 'category': return q.category_name === filter.label;
        case 'lesson': return q.lesson_name === filter.label;
        case 'skill': return q.skill_name === filter.label;
        case 'difficulty': return q.difficulty === filter.label.toLowerCase();
        default: return true;
      }
    });
  }, [report, filter]);

  function handleSelectTaxonomy(type: TaxonomyType, label: string) {
    setFilter((prev) => (prev && prev.type === type && prev.label === label ? null : { type, label }));
    questionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (loading)
    return <div className="grid min-h-screen place-items-center text-slate-600">Generating diagnostic report…</div>;

  if (errorMessage || !report || !derived) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">Diagnostic report unavailable</h1>
          <p className="mt-2 text-sm text-slate-600">{errorMessage}</p>
          <Link to="/assessment" className="mt-4 inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
            Return
          </Link>
        </div>
      </div>
    );
  }

  const { student_info, overall, breakdowns, questions, courses, org_settings } = report;
  const { studentName, completedLabel, durationLabel, avgTime, conceptual, strongSkills, weakSkills } = derived;

  return (
    <div className="print-page min-h-screen bg-slate-50">
      <div className="no-print sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">{org_settings?.org_name || 'Diagnostic Report'}</div>
            <div className="text-xs text-slate-500">Student diagnostic report</div>
          </div>
          <button onClick={() => window.print()} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white">
            Print / Save PDF
          </button>
        </div>
      </div>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <section className="rounded-3xl bg-gradient-to-br from-primary-600 to-primary-800 p-6 text-white shadow-floating">
          <div className="text-xs font-medium uppercase tracking-wide text-white/70">Diagnostic results</div>
          <h1 className="mt-1 text-3xl font-semibold">{studentName}</h1>
          <p className="mt-1 text-sm text-white/80">
            {student_info.assessment_name} · {completedLabel}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <HeroMetric label="Score" value={`${overall.percentage}%`} />
            <HeroMetric label="Tier" value={overall.level?.name || 'Evaluated'} />
            <HeroMetric label="Duration" value={durationLabel} />
            <HeroMetric label="Questions" value={`${questions.length}`} />
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <InsightCard label="Avg time / question" value={formatTime(avgTime)} />
          <InsightCard label="Rushed mistakes" value={`${overall.rushed_mistakes_count}`} />
          <InsightCard label="Timesink mistakes" value={`${overall.timesink_mistakes_count}`} />
          <InsightCard label="Conceptual errors" value={`${conceptual}`} />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionTitle title="Taxonomy mastery" subtitle="Tap any node to filter the questions below" />
          <div className="mt-4">
            <TaxonomyTree breakdowns={breakdowns} onSelect={handleSelectTaxonomy} activeFilter={filter} />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionTitle title="Where points were lost" />
          <div className="mt-4 flex flex-wrap gap-3">
            <ErrorChip label="Conceptual" count={conceptual} tone="bg-rose-100 text-rose-700" />
            <ErrorChip label="Rushed" count={overall.rushed_mistakes_count} tone="bg-amber-100 text-amber-700" />
            <ErrorChip label="Timesink" count={overall.timesink_mistakes_count} tone="bg-sky-100 text-sky-700" />
          </div>
          <p className="mt-3 text-sm text-slate-600">
            Of {overall.incorrect_count} incorrect answers, {conceptual} were conceptual, {overall.rushed_mistakes_count} rushed,
            and {overall.timesink_mistakes_count} lost to over-thinking.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionTitle title="Strengths & gaps" />
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <ListBlock title="Strengths" items={strongSkills.map((s) => `${s.label} · ${s.percentage}%`)} tone="border-emerald-200 bg-emerald-50 text-emerald-800" />
            <ListBlock title="Gaps to address" items={weakSkills.map((s) => `${s.label} · ${s.percentage}%`)} tone="border-amber-200 bg-amber-50 text-amber-800" />
          </div>
        </section>

        <section ref={questionsRef} className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <SectionTitle
              title="Question review"
              subtitle={filter ? `Filtered by ${filter.label}` : 'Tap a question to reveal the explanation'}
            />
            {filter && (
              <button
                onClick={() => setFilter(null)}
                className="no-print rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Clear filter
              </button>
            )}
          </div>
          <div className="mt-4 space-y-3">
            {visibleQuestions.length === 0 ? (
              <p className="text-sm text-slate-500">No questions match this filter.</p>
            ) : (
              visibleQuestions.map((q) => (
                <QuestionReviewCard
                  key={q.question_id}
                  question={q}
                  index={questions.indexOf(q)}
                  avgTime={avgTime}
                  highlight={!!filter}
                />
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionTitle title="Recommendation" />
          <p className="mt-2 text-sm text-slate-700">
            {overall.level?.recommendation || 'Continue with the engine-recommended pathway.'}
          </p>
          {courses.length > 0 && (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {courses.map((c) => (
                <div key={c.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="font-medium text-slate-900">{c.name}</div>
                  <p className="mt-1 text-sm text-slate-600">{c.description || 'Recommended follow-up course.'}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/10 p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-white/70">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function InsightCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
    </div>
  );
}

function ErrorChip({ label, count, tone }: { label: string; count: number; tone: string }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${tone}`}>
      {label}: {count}
    </span>
  );
}

function ListBlock({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  return (
    <div className={`rounded-xl border p-4 ${tone}`}>
      <div className="font-semibold">{title}</div>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
        {items.length ? items.map((item) => <li key={item}>{item}</li>) : <li>None identified</li>}
      </ul>
    </div>
  );
}