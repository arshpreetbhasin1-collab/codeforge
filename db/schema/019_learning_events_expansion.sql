-- Prompt 6: two real event types that were missing. Both represent a
-- genuine state change (not analytics inflation — see LEARNING EVENTS):
-- skill_mastery_updated fires only when recalculateSkillMastery() actually
-- changes the stored score; logic_mistake extends the existing
-- compilation_mistake/runtime_mistake/efficiency_mistake trio (007) so a
-- wrong_answer classified as a logic-family mistake (logic_error,
-- off_by_one, boundary_error, edge_case_failure, or a SQL mistake) also
-- gets a timeline entry — previously only compile/runtime/TLE did.
alter type learning_event_type add value if not exists 'skill_mastery_updated';
alter type learning_event_type add value if not exists 'logic_mistake';
