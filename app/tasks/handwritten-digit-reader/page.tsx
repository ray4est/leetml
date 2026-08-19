import { DIGIT_LAB_ANCHOR } from "@/lib/routes";
import { redirect } from "next/navigation";

export default function LegacyHandwrittenDigitReaderPage() {
  redirect(DIGIT_LAB_ANCHOR);
}
