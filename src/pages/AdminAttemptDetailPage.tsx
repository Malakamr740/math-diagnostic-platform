import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import TaxonomyTree from '../components/report/TaxonomyTree';
import QuestionReviewCard from '../components/report/QuestionReviewCard';
import { supabase } from '../lib/supabaseClient';
import type { ReportData, TaxonomyType } from '../components/report/Types';

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

export default function AdminAttemptDetailPage() {
  const { attemptId } = useParams();
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<{ type: TaxonomyType; label: string } | null>(null);
  const questionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchReport() {
      if (!attemptId) {
        setErrorMessage('Missing attempt id.');
        setLoading(false);
        return;
      }
      const { data, error } = await supabase.rpc('get_admin_attempt_report', { p_attempt_id: attemptId });
      if (error || !data) {
        setErrorMessage(error?.message || 'Could not load diagnostic results for this attempt.');
        setLoading(false);
        return;
      }
      setReport(data as ReportData);
      setLoading(false);
    }
    fetchReport();
  }, [attemptId]);

  const derived = useMemo(() => {
    if (!report) return null;
    const { student_info, overall, breakdowns } = report;
    const studentName =
      (student_info.registration_responses.full_name as string) ||
      (student_info.registration_responses.name as string) ||
      'Student';
    return {
      studentName,
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

  if (loading) return <div className="grid min-h-screen place-items-center text-slate-600">Loading student diagnostic report…</div>;

  if (errorMessage || !report || !derived) {
    return (
      <AdminLayout title="Report not found">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">Report not found</h1>
          <p className="mt-2 text-sm text-slate-600">{errorMessage}</p>
          <Link to="/admin/assessments" className="mt-4 inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
            Back to assessments
          </Link>
        </div>
      </AdminLayout>
    );
  }

  const { student_info, overall, breakdowns, questions, courses } = report;
  const { studentName, avgTime, conceptual, strongSkills, weakSkills } = derived;

  return (
    <AdminLayout
      title="Student diagnostic report"
      subtitle={`${studentName} · ${student_info.assessment_name}`}
      actions={
        <button onClick={() => window.print()} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white">
          Print / Save PDF
        </button>
      }
    >
      <div className="print-page space-y-6">
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <InsightCard label="Score" value={`${overall.percentage}%`} />
          <InsightCard label="Tier" value={overall.level?.name || 'Evaluated'} />
          <InsightCard label="Duration" value={formatTime(student_info.total_time_seconds)} />
          <InsightCard label="Questions" value={`${questions.length}`} />
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
      </div>
    </AdminLayout>
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