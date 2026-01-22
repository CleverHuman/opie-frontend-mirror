import { LucideIcon } from "lucide-react";
import { Collection, KnowledgeBasePermission } from "./knowledge-base";

export interface TokenRefresh {
  refresh: string;
  access: string;
}

export interface TokenVerify {
  token: string;
}

export interface Project {
  id?: string;
  uuid?: string;
  project_id?: string;
  project_uuid?: string;
  created_at?: string;
  updated_at?: string;
  name?: string;
  description?: string;
  custom_instruction?: string;
  instruction?: {
    content?: string;
  };
  owner?: number;
  team?: number;
  tags?: string[];
  starred_by?: number[];
  icon?: LucideIcon
  color?: string
  starred?: boolean
  lastUpdated?: string
  teamSize?: number
  chatCount?: number
  chatIcon?: LucideIcon
}

export interface PaginatedProjectList {
  count: number;
  next: string | null;
  previous: string | null;
  results: Project[];
}

export interface AgentInstruction {
  id: number;
  instruction: string;
  category: string;
  is_enabled: boolean;
  is_global: boolean;
  user: number;
  agent: number;
  created_at: string;
  updated_at: string;
}

export interface PatchedProject extends Partial<Project> {}

export interface Document {
  id: number;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface PaginatedDocumentList {
  count: number;
  next: string | null;
  previous: string | null;
  results: Document[];
}

export interface PatchedDocument extends Partial<Document> {}

export interface KnowledgeBase {
  id: number;
  name: string;
  description: string;
  knowledge_type: string;
  path: string;
  unique_code: string;
  knowledgebase_id: string;
  vector_table_name: string;
  chunk_size?: number;
  chunk_overlap?: number;
  created_at: string;
  updated_at: string;
  model_provider: number;
  is_file_linked?: boolean;
  permissions?: KnowledgeBasePermission[];
  permissions_input?: KnowledgeBasePermission[];
  role?: "owner" | "editor" | "viewer"
}

export interface PaginatedKnowledgeBaseList {
  count: number;
  next: string | null;
  previous: string | null;
  results: KnowledgeBase[];
}

export interface PatchedKnowledgeBase extends Partial<KnowledgeBase> {}

export interface KnowledgeBasePdfURL {
  id: number;
  kb: number;
  url: string;
  is_enabled: boolean;
  added_at: string;
}

export interface PaginatedKnowledgeBasePdfURLList {
  count: number;
  next: string | null;
  previous: string | null;
  results: KnowledgeBasePdfURL[];
}

export interface PatchedKnowledgeBasePdfURL extends Partial<KnowledgeBasePdfURL> {}

export interface StorageBucket {
  id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface PaginatedStorageBucketList {
  count: number;
  next: string | null;
  previous: string | null;
  results: StorageBucket[];
}

export interface PatchedStorageBucket extends Partial<StorageBucket> {}

export interface TeamMember {
  id: number;
  user_id: number;
  first_name: string;
  last_name: string;
  display_name: string;
  role: string;
}

export interface TeamInvitation {
  id: string;
  team: number;
  email: string;
  role: string;
  invited_by: string;
  is_accepted: boolean;
}

export interface SubscriptionPrice {
  id: string;
  product_name: string;
  human_readable_price: string;
  payment_amount: string;
  nickname: string;
  unit_amount: number;
}

export interface SubscriptionItem {
  id: string;
  price: SubscriptionPrice;
  quantity: number;
}

export interface TeamSubscription {
  id: string;
  display_name: string;
  start_date: string;
  billing_interval: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  status: string;
  quantity: number;
  items: SubscriptionItem[];
}

export interface Team {
  id: number;
  name: string;
  slug: string;
  members: TeamMember[];
  invitations: TeamInvitation[];
  dashboard_url: string;
  is_admin: boolean;
  subscription?: TeamSubscription;
  has_active_subscription: boolean;
  created_at: string;
  updated_at: string;
  is_current?: boolean;
}

export interface PaginatedTeamList {
  count: number;
  next: string | null;
  previous: string | null;
  results: Team[];
}

export interface PatchedTeam extends Partial<Team> {}

export interface Invitation {
  id: string;
  team: number;
  email: string;
  role: string;
  invited_by: string;
  is_accepted: boolean;
}

export interface PaginatedInvitationList {
  count: number;
  next: string | null;
  previous: string | null;
  results: Invitation[];
}

export interface PatchedInvitation extends Partial<Invitation> {}

export interface Agent {
  id: number;
  instructions: Instruction;
  expected_output: ExpectedOutput;
  name: string;
  description: string;
  unique_code: string;
  agent_id: string; 
  session_table: string;
  search_knowledge: boolean;
  add_datetime_to_instructions: boolean;
  show_tool_calls: boolean;
  markdown_enabled: boolean;
  debug_mode: boolean;
  num_history_responses: number;
  is_global: boolean;
  created_at: string;
  updated_at: string;
  user: number;
  model: number;
  knowledge_base: string;
  team: number | null;
  subscriptions: number[];
}

export interface AgentCreate {
  name: string;
  description: string;
  category: number;
  model: number;
  instructions_id: number;
  custom_instruction: string;
  expected_output_id: number;
  custom_excpected_output: string;
  expected_output_data: {
    title: string;
    expected_output: string;
    category: string;
    is_enabled: boolean;
    is_global: boolean;
    user: number;
    agent: number;
  };
  knowledge_base: string;
  search_knowledge: boolean;
  cite_knowledge: boolean;
  add_datetime_to_instructions: boolean;
  show_tool_calls: boolean;
  markdown_enabled: boolean;
  debug_mode: boolean;
  num_history_responses: number;
  is_global: boolean;
  team: number | null;
  subscriptions: number[];
}


export interface PaginatedAgentList {
  count: number;
  next: string | null;
  previous: string | null;
  results: Agent[];
}

export interface PatchedAgent extends Partial<Agent> {}

export interface DocumentTag {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface PaginatedDocumentTagList {
  count: number;
  next: string | null;
  previous: string | null;
  results: DocumentTag[];
}

export interface PatchedDocumentTag extends Partial<DocumentTag> {}

export interface Tag {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface PaginatedTagList {
  count: number;
  next: string | null;
  previous: string | null;
  results: Tag[];
}

export interface PatchedTag extends Partial<Tag> {}

export interface FileTag {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface PaginatedFileTagList {
  count: number;
  next: string | null;
  previous: string | null;
  results: FileTag[];
}

export interface PatchedFileTag extends Partial<FileTag> {}

export interface File {
  uuid: string;
  title: string;
  description: string | null;
  file: string;
  file_type: string;
  storage_bucket: number | null;
  storage_path: string;
  original_path: string | null;
  uploaded_by: number | null;
  team: number | null;
  source: string | null;
  visibility: "public" | "private";
  is_global: boolean;
  created_at: string;
  updated_at: string;
  collection: Collection | null;
  filesize: number;
}

export interface PaginatedFileList {
  count: number;
  next: string | null;
  previous: string | null;
  results: File[];
}

export interface PatchedFile extends Partial<File> {}

export interface Login {
  email: string;
  password: string;
}

export interface LoginResponse {
  status: number;
  data: {
    user: User;
    methods: Array<{
      method: string;
      at: number;
      email: string;
    }>;
  };
  meta: {
    is_authenticated: boolean;
  };
}

export interface Register {
  email: string;
  password1: string;
  password2: string;
  password: string;
}

export interface PasswordChange {
  old_password: string;
  new_password1: string;
  new_password2: string;
}

export interface OtpRequest {
  otp: string;
}

export interface RestAuthDetail {
  detail: string;
}

export interface JWT {
  access: string;
  refresh: string;
  user: User;
}

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  avatar_url: string;
  get_display_name: string;
  created_at: string;
  updated_at: string;
  language?: string | 'en-US';
  is_superuser?: boolean;
  is_staff?: boolean;
}

export interface PatchedUser extends Partial<User> {}

export interface UserSignupStats {
  date: string;
  count: number;
}

export interface PaginatedExpectedOutputs {
  count: number;
  next: string | null;
  previous: string | null;
  results: ExpectedOutput[];
}

export interface AgentTemplateResponse {
  instructions: Instruction[];
  expected_outputs: ExpectedOutput[];
}

export interface Instruction {
  id: number;
  updated_at: string;
  title: string;
  instruction: string;
  category: string;
  is_template: boolean;
  is_enabled: boolean;
  is_global: boolean;
  is_system: boolean;
  created_at: string;
  user: number;
}

export interface ExpectedOutput {
  id: number;
  updated_at: string;
  title: string;
  expected_output: string;
  category: string;
  is_enabled: boolean;
  is_global: boolean;
  created_at: string;
  user: number;
  agent: number | null;
}

export interface VaultFile {
  id: number;
  uuid: string;
  file: string;
  project_uuid: string;
  uploaded_by: number;
  team: number;
  shared_with_users: number[];
  shared_with_teams: number[];
  inherited_users: string;
  inherited_teams: string;
  is_folder: Boolean; 
  type: string;
  embedding_status: string;
  parent_id: number; // Parent folder ID, 0 if root level
  created_at: string; // ISO date string
  updated_at: string; // ISO date string
}

export interface AuthError {
  status: number;
  errors: Array<{
    message: string;
    code: string;
    param: string;
  }>;
}

export interface AuthErrorResponse {
  status: number;
  errors: Array<{
    message: string;
    code: string;
    param: string;
  }>;
}

// Django Allauth Headless API Types
export interface AllauthUser {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  display: string;
  has_usable_password: boolean;
}

export interface AllauthUserResponse {
  status: number;
  data: AllauthUser;
}

export interface AllauthUserUpdate {
  first_name?: string;
  last_name?: string;
  username?: string;
}

export interface AllauthEmailAddress {
  email: string;
  verified: boolean;
  primary: boolean;
}

export interface AllauthEmailResponse {
  status: number;
  data: AllauthEmailAddress[];
}

export interface AllauthEmailAdd {
  email: string;
}

export interface AllauthEmailVerify {
  email: string;
}

export interface AllauthEmailSetPrimary {
  email: string;
}

export interface AllauthEmailDelete {
  email: string;
}

export interface AllauthPasswordChange {
  current_password: string;
  new_password: string;
}

export interface AllauthPasswordReset {
  email: string;
}

export interface AllauthPasswordResetConfirm {
  password: string;
}

export interface AllauthMFAAuthenticator {
  id: string;
  type: 'totp' | 'recovery_codes' | 'webauthn';
  data: {
    secret?: string;
    qr_code_svg?: string;
    recovery_codes?: string[];
  };
  created_at: string;
  last_used_at?: string;
}

export interface AllauthMFAAuthenticatorsResponse {
  status: number;
  data: AllauthMFAAuthenticator[];
}

export interface AllauthMFATOTPAdd {
  // No body required for initial request
}

export interface AllauthMFATOTPActivate {
  code: string;
}

export interface AllauthMFAAuthenticate {
  code: string;
}

export interface AllauthMFAChallenge {
  // Response contains challenge data
  status: number;
  data: {
    challenge?: string;
    [key: string]: any;
  };
}

export interface AllauthResponse<T = any> {
  status: number;
  data?: T;
  errors?: Array<{
    message: string;
    code: string;
    param?: string;
  }>;
  meta?: {
    [key: string]: any;
  };
}

// Platform API Key Types
export interface PlatformApiKey {
  id: string;
  name: string;
  description?: string;
  key: string;
  masked_key: string;
  created_at: string;
  updated_at: string;
  expires_at?: string;
  last_used_at?: string;
  is_active: boolean;
  usage_count?: number;
  permissions?: string[];
  user: number;
  team?: number;
}

export interface PlatformApiKeyCreate {
  name: string;
  description?: string;
  expires_at?: string;
  permissions?: string[];
}

export interface PlatformApiKeyUpdate {
  name?: string;
  description?: string;
  expires_at?: string;
  is_active?: boolean;
  permissions?: string[];
}

export interface PaginatedPlatformApiKeyList {
  count: number;
  next: string | null;
  previous: string | null;
  results: PlatformApiKey[];
}

export interface PlatformApiKeyGenerated {
  id: string;
  name: string;
  key: string;
  created_at: string;
  expires_at?: string;
}

// Workflow Types
export interface WorkflowPermission {
  id: string;
  workflow: number;
  team: number;
  role: "viewer" | "editor" | "owner";
  created_at: string;
  created_by: number | null;
}

export interface Workflow {
  id: number;
  name: string;
  description: string | null;
  created_by: number | null;
  team: number | null;
  permissions: WorkflowPermission[];
  definition: {
    agent_ids?: string[];
    tool_ids?: number[];
    [key: string]: any;
  };
  trigger_type: string | null;
  trigger_config: {
    [key: string]: any;
  };
  created_at: string;
  updated_at: string;
}

export interface PaginatedWorkflowList {
  count: number;
  next: string | null;
  previous: string | null;
  results: Workflow[];
}

export interface PatchedWorkflow extends Partial<Workflow> {}

export interface WorkflowRun {
  id: number;
  workflow: number;
  status: "running" | "completed" | "failed";
  started_at: string;
  completed_at: string | null;
  input_data: {
    [key: string]: any;
  };
  output_data: {
    [key: string]: any;
  };
  state: {
    [key: string]: any;
  };
  run_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface PaginatedWorkflowRunList {
  count: number;
  next: string | null;
  previous: string | null;
  results: WorkflowRun[];
}

export interface PatchedWorkflowRun extends Partial<WorkflowRun> {}

export interface WorkflowNode {
  id: number;
  workflow: number;
  name: string;
  node_type: string;
  position_x: number;
  position_y: number;
  config: {
    [key: string]: any;
  };
  created_at: string;
  updated_at: string;
}

export interface WorkflowNodesResponse {
  count: number;
  nodes: WorkflowNode[];
}

export interface PaginatedWorkflowNodeList {
  count: number;
  next: string | null;
  previous: string | null;
  results: WorkflowNode[];
}

export interface PatchedWorkflowNode extends Partial<WorkflowNode> {}

export interface WorkflowEdge {
  id: number;
  workflow: number;
  source_node: number;
  target_node: number;
  config: {
    [key: string]: any;
  };
  created_at: string;
  updated_at: string;
}

export interface WorkflowEdgesResponse {
  count: number;
  edges: WorkflowEdge[];
}

export interface PaginatedWorkflowEdgeList {
  count: number;
  next: string | null;
  previous: string | null;
  results: WorkflowEdge[];
}

export interface PatchedWorkflowEdge extends Partial<WorkflowEdge> {}

// Helper function to get project ID from various possible fields
export const getProjectId = (project: Project): string | undefined => {
  // Prioritize UUID fields over the id field
  // The id field might still contain numeric values from the backend
  return project.uuid || project.project_uuid || project.project_id || project.id;
};