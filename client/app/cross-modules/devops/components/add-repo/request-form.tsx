import { InfoTooltip } from "@/components/info-tool-tip/info-tool-tip";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui-kits/accordion/accordion";
import { Button } from "@/components/ui-kits/button/button";
import { DialogClose } from "@/components/ui-kits/dialog/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui-kits/form/form";
import { Input } from "@/components/ui-kits/input/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui-kits/radio-group/radio-group";

import { Switch } from "@/components/ui-kits/switch/switch";
import { Textarea } from "@/components/ui-kits/textarea/textarea";
import { useProjectStore } from "@/store/useProjectStore";
import {
  HTTP_METHODS,
  MONITOR_INTERVAL,
  MONITOR_SOURCE_TYPES,
  REVERSE_MONITOR_INTERVAL,
} from "@blocks-devops/constants/alert.constant";
import {
  useAddSingleMonitor,
  useGetMonitorById,
  useUpdateSingleMonitor,
} from "@blocks-devops/hooks/alerts";
import { useForm } from "react-hook-form";
import { addAlertRepoDefaultValues, AddAlertRepoForm, addAlertRepoSchema } from "./utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { ErrorTransformer } from "@blocks-ai/utils/error-transform";
import { useEffect } from "react";
import { Slider } from "@/components/ui-kits/slider/slider";
import { useNavigate } from "react-router-dom";

const RequestForm = ({
  itemId,
  onClose,
  repoId,
  repoName,
  externalServiceId,
}: {
  itemId?: string;
  repoId: string;
  repoName: string;
  externalServiceId?: string;
  onClose: (value: boolean) => void;
}) => {
  const { isPending, mutateAsync } = useAddSingleMonitor();
  const updateMutation = useUpdateSingleMonitor();
  const navigate = useNavigate();
  const projectKey = useProjectStore().selectedProject?.tenantId || "";
  const { data: monitorData } = useGetMonitorById(itemId || "");

  const form = useForm<AddAlertRepoForm>({
    defaultValues: addAlertRepoDefaultValues,
    resolver: zodResolver(addAlertRepoSchema),
    mode: "onChange",
  });
  const httpMethod = form.watch("requestConfiguration.http_methods");
  const sendAsJson = form.watch("requestConfiguration.json_switcher");
  useEffect(() => {
    if (monitorData?.data && itemId) {
      const data = monitorData.data;
      const headers = JSON.parse(data.customHttpHeaders);
      const [key, value] = Object.entries(headers)[0];
      form.reset({
        name: data.name,
        urlMonitor: data.url,
        monitorSettings: {
          monitor_interval: REVERSE_MONITOR_INTERVAL[data.intervalInSeconds],
          request_timeout: REVERSE_MONITOR_INTERVAL[data.timeoutInSeconds],
          check_ssl_errors: false,
          ssl_expiry_reminders: false,
          domain_expiry_reminders: false,
        },
        requestConfiguration: {
          http_methods: data.httpMethodType?.toString(),
          request_body: !data?.customPayload
            ? JSON.stringify({ key: "value" })
            : JSON.stringify(JSON.parse(data?.customPayload as string)),
          json_switcher: !!(key && value),
          x_header_name: key,
          value: value as string,
        },
      });
    }
  }, [monitorData, itemId, form]);

  const onSubmit = async (formValues: AddAlertRepoForm) => {
    try {
      const payload: any = {
        itemId: itemId || "",
        projectKey,
        name: formValues.name,
        repoName: repoName || "",
        repoId: repoId || "",
        url: formValues.urlMonitor,
        monitorType: formValues.requestConfiguration.http_methods,
        customPayload:
          formValues.requestConfiguration.http_methods === "2"
            ? formValues.requestConfiguration.request_body
            : "",
        intervalInSeconds: MONITOR_INTERVAL[formValues.monitorSettings.monitor_interval],
        timeoutInSeconds: MONITOR_INTERVAL[formValues.monitorSettings.request_timeout],
        customHttpHeaders: JSON.stringify({
          [formValues.requestConfiguration.x_header_name]: formValues.requestConfiguration.value,
        }),
        isActive: true,
        httpMethodType: formValues.requestConfiguration.http_methods,
        protocolType: "HTTP",
        externalServiceId: externalServiceId,
      };
      if (externalServiceId) {
        payload.monitorSourceType = MONITOR_SOURCE_TYPES.ExternalServices;
      }

      let res;
      if (!itemId) {
        res = await mutateAsync(payload);
        if (res.isSuccess) {
          const itemId = res?.data?.itemId;
          navigate(`/health/monitor/${itemId}`);
        }
      } else {
        res = await updateMutation.mutateAsync(payload);
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
      {" "}
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="flex flex-col gap-4">
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
            name="urlMonitor"
            render={({ field }) => (
              <FormItem>
                <FormLabel>URL to monitor</FormLabel>
                <FormControl>
                  <Input {...field} disabled={itemId ? true : false} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="monitorSettings">
            {" "}
            <AccordionTrigger className="flex-row-reverse justify-end gap-4 hover:no-underline">
              Monitor settings
            </AccordionTrigger>
            <AccordionContent className="flex flex-col gap-4">
              <FormField
                control={form.control}
                name="monitorSettings.monitor_interval"
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
                name="monitorSettings.request_timeout"
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-2">
                    <FormLabel className="flex items-center gap-2">
                      Request timeout
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
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="requestConfig">
            {" "}
            <AccordionTrigger className="flex-row-reverse justify-end gap-4 hover:no-underline">
              Request Configuration
            </AccordionTrigger>
            <AccordionContent>
              <div className="flex flex-col gap-4">
                <FormField
                  control={form.control}
                  name="requestConfiguration.http_methods"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>HTTP method</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          value={field.value}
                          className="flex flex-col gap-4"
                        >
                          <div className="flex gap-6">
                            {HTTP_METHODS.map((item, index) => (
                              <FormItem className="flex items-center gap-2" key={index}>
                                <FormControl>
                                  <RadioGroupItem value={item.value} />
                                </FormControl>
                                <FormLabel className="!mt-0">{item.label}</FormLabel>
                              </FormItem>
                            ))}
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="requestConfiguration.request_body"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Request body</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter request body content..."
                          rows={3}
                          disabled={httpMethod !== "2"} // Only enable when POST is selected
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="requestConfiguration.json_switcher"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <FormLabel className="flex items-center gap-2">
                        Send as JSON (application/json)
                        <InfoTooltip content="Set Content-Type header to application/json for API requests" />
                      </FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          className="!mt-0"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                {sendAsJson && (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <span className="text-lg font-semibold md:col-span-2">Request headers</span>

                    <FormField
                      control={form.control}
                      name="requestConfiguration.x_header_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>X-Header-Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="requestConfiguration.value"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Value</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

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

export default RequestForm;
