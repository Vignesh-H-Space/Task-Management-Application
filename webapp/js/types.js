/**
 * Tesseract Core Type Definitions (JSDoc Type Schema)
 * Provides centralized type safety, IDE autocompletion, and schema contracts.
 * 
 * @module Types
 */

/**
 * @typedef {'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'general'} TimeTier
 * Strategic horizon tier defining the scope and time horizon of a goal or task.
 */

/**
 * @typedef {'low' | 'medium' | 'high' | 'urgent'} PriorityLevel
 * Urgency/importance prioritization level.
 */

/**
 * @typedef {'backlog' | 'todo' | 'in_progress' | 'done'} KanbanStatus
 * Workflow state in the multi-column board view.
 */

/**
 * @typedef {'q1' | 'q2' | 'q3' | 'q4'} QuadrantId
 * Eisenhower matrix quadrant:
 * - q1: DO FIRST (Urgent & Important)
 * - q2: SCHEDULE (Not Urgent & Important)
 * - q3: DELEGATE (Urgent & Not Important)
 * - q4: ELIMINATE (Not Urgent & Not Important)
 */

/**
 * @typedef {Object} Subtask
 * @property {string} id Unique subtask identifier
 * @property {string} title Description of the milestone step
 * @property {boolean} completed Whether the step is completed
 */

/**
 * @typedef {Object} Task
 * @property {string} id Unique task identifier
 * @property {string} title Task title or objective
 * @property {string} [description] Detailed description or success criteria
 * @property {TimeTier} tier Strategic time horizon tier
 * @property {PriorityLevel} priority Priority rating
 * @property {string} [category] Life domain category (e.g. Engineering, Product, Career, Health)
 * @property {string} [dueDate] Due date in YYYY-MM-DD format
 * @property {string|null} [parentId] Upward cascade linkage to a higher-horizon goal
 * @property {string[]} [tags] Array of tag strings
 * @property {Subtask[]} [subtasks] Array of milestone checklist items
 * @property {boolean} completed Completion status
 * @property {string|null} [completedAt] ISO timestamp of completion
 * @property {KanbanStatus} [kanbanStatus] Active Kanban column state
 * @property {string} [backlogId] Linked Executive Backlog ID if synchronized
 * @property {string} [createdAt] ISO timestamp of creation
 */

/**
 * @typedef {Object} PersonalCreed
 * @property {string} mission Personal North Star mission statement
 * @property {string} motto Executive mantra or guiding creed
 * @property {string[]} values Core operating values
 */

/**
 * @typedef {Object} UserProfile
 * @property {string} name Display name
 * @property {string|null} [image] Base64 or URL avatar image
 * @property {PersonalCreed} [creed] Personal North Star creed definition
 */

/**
 * @typedef {Object} StreakData
 * @property {number} count Current consecutive day streak count
 * @property {string|null} lastDate Last execution date in YYYY-MM-DD
 */

/**
 * @typedef {Object} Habit
 * @property {string} id Unique habit identifier
 * @property {string} title Habit name
 * @property {string} icon Emoji or icon representation
 * @property {string} category Category classification
 * @property {number} targetDays Target consistency frequency per week
 * @property {string[]} history Array of completed dates (YYYY-MM-DD)
 */

/**
 * @typedef {Object} ExecutiveBackup
 * @property {'2.0'} version Backup schema version
 * @property {string} exportedAt ISO timestamp of export
 * @property {Task[]} tasks All active matrix tasks
 * @property {UserProfile} profile User profile configuration
 * @property {StreakData} streak Execution momentum data
 * @property {Object|null} xpData Gamified XP and badge progress
 * @property {Habit[]|null} habits Cadence consistency habits
 * @property {Object[]|null} bucketList Bucket list dreams
 * @property {Object[]|null} focusSessions Historical deep work sessions
 */

// Global schema export
if (typeof window !== 'undefined') {
  window.__TesseractTypes = true;
}
