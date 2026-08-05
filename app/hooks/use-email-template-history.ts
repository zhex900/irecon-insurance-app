import { useCallback, useEffect, useRef, useState } from "react";

export type EmailTemplateSnapshot = { subject: string; body: string };

export function useEmailTemplateHistory({
  canEdit,
  subject,
  codeHtml,
  setSubject,
  setCodeHtml,
  setFrameKey,
}: {
  canEdit: boolean;
  subject: string;
  codeHtml: string;
  setSubject: (value: string) => void;
  setCodeHtml: (value: string | ((prev: string) => string)) => void;
  setFrameKey: (updater: (key: number) => number) => void;
}) {
  const historyRef = useRef<EmailTemplateSnapshot[]>([]);
  const historyIndexRef = useRef(0);
  const skipHistoryRef = useRef(false);
  const historyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [canUndoHistory, setCanUndoHistory] = useState(false);
  const [canRedoHistory, setCanRedoHistory] = useState(false);

  const syncHistoryButtons = useCallback(() => {
    setCanUndoHistory(historyIndexRef.current > 0);
    setCanRedoHistory(historyIndexRef.current < historyRef.current.length - 1);
  }, []);

  const currentSnapshot = useCallback((): EmailTemplateSnapshot => {
    return { subject, body: codeHtml };
  }, [subject, codeHtml]);

  const pushHistory = useCallback(
    (snapshot?: EmailTemplateSnapshot) => {
      if (skipHistoryRef.current) return;
      const next = snapshot ?? currentSnapshot();
      const current = historyRef.current[historyIndexRef.current];
      if (
        current &&
        current.subject === next.subject &&
        current.body === next.body
      ) {
        return;
      }
      const truncated = historyRef.current.slice(
        0,
        historyIndexRef.current + 1,
      );
      truncated.push(next);
      if (truncated.length > 50) truncated.shift();
      historyRef.current = truncated;
      historyIndexRef.current = truncated.length - 1;
      syncHistoryButtons();
    },
    [currentSnapshot, syncHistoryButtons],
  );

  const scheduleHistoryPush = useCallback(() => {
    if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
    historyTimerRef.current = setTimeout(() => {
      pushHistory();
      syncHistoryButtons();
    }, 600);
  }, [pushHistory, syncHistoryButtons]);

  const applySnapshot = useCallback(
    (snapshot: EmailTemplateSnapshot) => {
      skipHistoryRef.current = true;
      setSubject(snapshot.subject);
      setCodeHtml(snapshot.body);
      setFrameKey((key) => key + 1);
      requestAnimationFrame(() => {
        skipHistoryRef.current = false;
        syncHistoryButtons();
      });
    },
    [setSubject, setCodeHtml, setFrameKey, syncHistoryButtons],
  );

  const resetHistory = useCallback(
    (snapshot: EmailTemplateSnapshot) => {
      historyRef.current = [snapshot];
      historyIndexRef.current = 0;
      syncHistoryButtons();
    },
    [syncHistoryButtons],
  );

  const handleUndo = useCallback(() => {
    if (!canEdit || historyIndexRef.current <= 0) return;
    if (historyIndexRef.current === historyRef.current.length - 1) {
      pushHistory();
    }
    historyIndexRef.current -= 1;
    const snapshot = historyRef.current[historyIndexRef.current];
    if (snapshot) applySnapshot(snapshot);
  }, [canEdit, pushHistory, applySnapshot]);

  const handleRedo = useCallback(() => {
    if (!canEdit || historyIndexRef.current >= historyRef.current.length - 1) {
      return;
    }
    historyIndexRef.current += 1;
    const snapshot = historyRef.current[historyIndexRef.current];
    if (snapshot) applySnapshot(snapshot);
  }, [canEdit, applySnapshot]);

  useEffect(() => {
    return () => {
      if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
    };
  }, []);

  return {
    canUndoHistory,
    canRedoHistory,
    pushHistory,
    scheduleHistoryPush,
    resetHistory,
    handleUndo,
    handleRedo,
  };
}
