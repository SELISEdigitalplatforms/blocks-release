import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui-kits/form/form";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui-kits/input/input";
import { DialogClose } from "@/components/ui-kits/dialog/dialog";
import { Button } from "@/components/ui-kits/button/button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { addACallbackSchema, AddCallbackForm, addCallbackFormDefaultValues } from "./utils";
import {
  MONITOR_INTERVAL,
  MONITOR_SOURCE_TYPES,
  REVERSE_MONITOR_INTERVAL,
} from "@blocks-devops/constants/alert.constant";
import { InfoTooltip } from "@/components/info-tool-tip/info-tool-tip";
import { Slider } from "@/components/ui-kits/slider/slider";
import { useGetHealthById, useSaveHealth, useUpdateHealth } from "@blocks-devops/hooks/alerts";
import { useProjectStore } from "@/store/useProjectStore";
import { useEffect } from "react";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { ErrorTransformer } from "@blocks-ai/utils/error-transform";

const CallbackForm = ({
  itemId,
  repoName,
  repoId,
  externalServiceId,
  onClose,
}: {
  itemId?: string;
  onClose: (value: boolean) => void;
  repoName: string;
  repoId: string;
  externalServiceId?: string;
}) => {
  const { isPending, mutateAsync } = useSaveHealth();
  const updateMutation = useUpdateHealth();
  const navigate = useNavigate();

  const projectKey = useProjectStore().selectedProject?.tenantId || "";
  const { data: healthData } = useGetHealthById(itemId || "");

  const form = useForm<AddCallbackForm>({
    defaultValues: addCallbackFormDefaultValues,
    resolver: zodResolver(addACallbackSchema),
    mode: "onChange",
  });

  useEffect(() => {
    if (healthData?.data && itemId) {
      const data = healthData.data;
      form.reset({
        name: data.name,
        monitor_interval: REVERSE_MONITOR_INTERVAL[data.intervalInSeconds],
        grace_time: REVERSE_MONITOR_INTERVAL[data.gracePeriodInSeconds],
      });
    }
  }, [healthData, itemId, form]);
  const onSubmit = async (formValues: AddCallbackForm) => {
    try {
      const payload: any = {
        repoName: repoName,
        repoId: repoId,
        projectKey,
        name: formValues.name,
        intervalInSeconds: MONITOR_INTERVAL[formValues.monitor_interval],
        gracePeriodInSeconds: MONITOR_INTERVAL[formValues.grace_time],
        isActive: true,
        externalServiceId: externalServiceId,
      };
      if (externalServiceId) {
        payload.monitorSourceType = MONITOR_SOURCE_TYPES.ExternalServices;
      }
      let res;
      if (!itemId) {
        res = await mutateAsync(payload);
        if (res) {
          const itemId = res?.data?.itemId;
          navigate(`/health/monitor/${itemId}`);
        }
      } else {
        res = await updateMutation.mutateAsync({ ...payload, itemId });
      }
      if (!res.isSuccess) return showErrorToast({ errors: res.message });
      showSuccessToast({
        description: itemId ? "Monitor successfully updated." : "Monitor successfully created.",
      });
      form.reset();
      onClose(false);
    } catch (error) {
      return showErrorToast({ errors: ErrorTransformer(error) });
    }
  };
  return (
    <Form {...form}>
      <div className="flex flex-col gap-4"></div>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="flex flex-col gap-4">
          {" "}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    disabled={itemId ? true : false}
                    onBlur={(e) => {
                      field.onChange(e.target.value.trim());
                      field.onBlur();
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="monitor_interval"
            render={({ field }) => (
              <FormItem className="flex flex-col gap-2">
                <FormLabel className="flex items-center gap-2">
                  Monitor interval
                  <InfoTooltip content="How frequently the system will check your endpoint for availability and performance" />
                </FormLabel>
                <FormControl>
                  <Slider
                    min={1}
                    max={5}
                    step={1}
                    value={[field.value]}
                    onValueChange={(values) => field.onChange(values[0])}
                  />
                </FormControl>

                <div className="flex justify-between px-1 text-xs text-muted-foreground">
                  <span>30s</span>
                  <span>1min</span>
                  <span>5min</span>
                  <span>30min</span>
                  <span>1h</span>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="grace_time"
            render={({ field }) => (
              <FormItem className="flex flex-col gap-2">
                <FormLabel className="flex items-center gap-2">
                  Grace Time
                  <InfoTooltip content="Maximum time to wait for a response from your endpoint before considering it timed out" />
                </FormLabel>
                <FormControl>
                  <Slider
                    min={1}
                    max={5}
                    step={1}
                    value={[field.value]}
                    onValueChange={(values) => field.onChange(values[0])}
                  />
                </FormControl>
                <div className="flex justify-between px-1 text-xs text-muted-foreground">
                  <span>30s</span>
                  <span>1min</span>
                  <span>5min</span>
                  <span>30min</span>
                  <span>1h</span>
                </div>

                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="submit" disabled={isPending || !form.formState.isValid}>
            Save
          </Button>
        </div>
      </form>
    </Form>
  );
};
export default CallbackForm;
