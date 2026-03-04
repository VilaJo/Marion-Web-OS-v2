# Focus Mode V2 QA Checklist

## Scope
- Timer/session lifecycle
- Pomodoro transitions
- Linked task completion flow
- Anti-distraction notification behavior
- Coach Franck `/api/v1/chat/zen` focus context usage
- Metrics and history rendering

## Environment
- Frontend: latest build on desktop and mobile viewport
- Backend: `franck_server.py` running
- AI mode: test at least one local model and cloud mode

## Functional Checklist

### 1. Session Lifecycle
- [ ] Open Focus Mode and verify default state is `idle`.
- [ ] Enter a session objective and start a session.
- [ ] Verify timer counts down every second.
- [ ] Pause, resume, and reset work as expected.
- [ ] Manual complete action creates a completed session entry.

### 2. Pomodoro Behavior
- [ ] Select 25/50/90 minute preset and verify timer reflects choice.
- [ ] Complete a focus phase and verify transition to break phase.
- [ ] Verify short/long break durations from settings.
- [ ] Enable `Auto next` and verify automatic transition between phases.
- [ ] Disable `Auto next` and verify timer waits for manual restart.

### 3. Linked Task Flow
- [ ] Select project and active task before starting session.
- [ ] Complete the session and click `Marquer tâche faite`.
- [ ] Verify linked task is persisted as completed (`done` column).
- [ ] Verify task disappears from active task selector afterward.

### 4. Anti-Distraction Notifications
- [ ] Start a focus session with mute-toasts setting enabled.
- [ ] Trigger non-critical notifications (`info`, `success`) and verify no toast appears immediately.
- [ ] Trigger critical `error` notification and verify it still appears.
- [ ] End/pause/exit session and verify deferred toasts are flushed.

### 5. Coach Franck Focus Context
- [ ] Open chat in Focus Mode and send a normal coaching message.
- [ ] Send command-style prompts: `plan`, `bloque`, `pause`, `reprendre`, `bilan`.
- [ ] Verify answer structure is concise and action-oriented.
- [ ] Verify responses remain available in local/cloud/hybrid routing.

### 6. Metrics & History
- [ ] Complete multiple sessions and verify weekly KPI cards update.
- [ ] Verify recent sessions list shows objective/date/minutes.
- [ ] Reload page and verify history/settings persistence.

## Non-Functional Checklist
- [ ] Timer remains accurate after tab background/foreground transitions.
- [ ] No crashes when Focus Mode opens/closes repeatedly.
- [ ] Mobile layout remains usable at narrow widths.
- [ ] No console errors during normal flow.
- [ ] Footer action bar stays visible on short screens (13" laptop and mobile).
- [ ] `Quitter le mode Focus` remains accessible and never overlaps with chat trigger.
- [ ] During active session, exiting asks for confirmation before leaving.
- [ ] `prefers-reduced-motion` disables non-essential pulse/entry animations.
- [ ] Calm mode reduces visual intensity and keeps advanced sections compact while running.

## Regression Checklist
- [ ] Ambient sounds still toggle and volume slider still works.
- [ ] Existing Franck chat outside Focus Mode is unaffected.
- [ ] Existing notification center still receives all notifications.
