import type { Certificate } from "@/types"

export type PendingCert = Certificate & {
  student_name?: string
  course_title?: string
}
