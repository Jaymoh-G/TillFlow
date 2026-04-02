import React, { Suspense } from "react";

export const LazyWrapper = ({
  children
}) => <Suspense>{children}</Suspense>;