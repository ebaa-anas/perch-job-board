import { redirect } from "next/navigation";

/** Legacy path — the post-a-job form now lives in the recruiter dashboard. */
export default function CreateJobRedirect() {
  redirect("/dashboard/jobs/new");
}
