import { motion } from "framer-motion";

import { SPRING } from "../../shared/motion.js";

export function UserBubble({ text }: { text: string }) {
  return <motion.p
    initial={{ opacity: 0, y: 12, scale: 0.98 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={SPRING}
    style={{ originX: 1, originY: 1 }}
    className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-muted px-4 py-2.5 text-[15px] leading-6 whitespace-pre-wrap"
  >{text}</motion.p>;
}
