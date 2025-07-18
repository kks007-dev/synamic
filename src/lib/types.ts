export interface ScheduleTask {
  time: string;
  task: string;
  duration?: string;
}

export type Priority = {
  id: string;
  text: string;
};
