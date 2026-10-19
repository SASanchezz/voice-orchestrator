import type { UiState } from "../protocol.js";
import type { TodayBudget } from "./today-budget.js";
import type { TodoItemViews } from "./todo-item-views.js";
import type { UiStateView } from "./ui-state-view.js";

/** The page's whole state: the live parts, today's spending with the budget's limits, and your to-do list. */
export class PageStateView {
  constructor(
    private live: UiStateView,
    private budget: TodayBudget,
    private todo: TodoItemViews,
  ) {}

  state(): UiState {
    return { ...this.live.state(), budget: this.budget.view(), todo: this.todo.view() };
  }
}
