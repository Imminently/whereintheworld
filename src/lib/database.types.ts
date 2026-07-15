import type { GamePhase } from "../types";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      games: {
        Row: {
          id: string;
          title: string;
          code_hash: string;
          code_salt: string;
          host_user_id: string;
          phase: GamePhase;
          current_round_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          code_hash: string;
          code_salt: string;
          host_user_id: string;
          phase?: GamePhase;
          current_round_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          code_hash?: string;
          code_salt?: string;
          host_user_id?: string;
          phase?: GamePhase;
          current_round_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      team_members: {
        Row: {
          id: string;
          game_id: string;
          display_name: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          game_id: string;
          display_name: string;
          sort_order: number;
          created_at?: string;
        };
        Update: {
          display_name?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      rounds: {
        Row: {
          id: string;
          game_id: string;
          subject_member_id: string;
          photo_object_key: string | null;
          display_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          game_id: string;
          subject_member_id: string;
          photo_object_key?: string | null;
          display_order: number;
          created_at?: string;
        };
        Update: {
          subject_member_id?: string;
          photo_object_key?: string | null;
          display_order?: number;
        };
        Relationships: [];
      };
      round_answers: {
        Row: {
          round_id: string;
          latitude: number;
          longitude: number;
          location_label: string;
          created_at: string;
        };
        Insert: {
          round_id: string;
          latitude: number;
          longitude: number;
          location_label: string;
          created_at?: string;
        };
        Update: {
          latitude?: number;
          longitude?: number;
          location_label?: string;
        };
        Relationships: [];
      };
      participants: {
        Row: {
          id: string;
          game_id: string;
          user_id: string | null;
          team_member_id: string;
          display_name: string;
          session_token_hash: string;
          joined_at: string;
        };
        Insert: {
          id?: string;
          game_id: string;
          user_id?: string | null;
          team_member_id: string;
          display_name: string;
          session_token_hash: string;
          joined_at?: string;
        };
        Update: {
          display_name?: string;
          session_token_hash?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      guesses: {
        Row: {
          id: string;
          game_id: string;
          round_id: string;
          participant_id: string;
          latitude: number;
          longitude: number;
          submitted_at: string;
        };
        Insert: {
          id?: string;
          game_id: string;
          round_id: string;
          participant_id: string;
          latitude: number;
          longitude: number;
          submitted_at?: string;
        };
        Update: {
          latitude?: number;
          longitude?: number;
          submitted_at?: string;
        };
        Relationships: [];
      };
      round_reveals: {
        Row: {
          game_id: string;
          round_id: string;
          latitude: number;
          longitude: number;
          location_label: string;
          revealed_at: string;
        };
        Insert: {
          game_id: string;
          round_id: string;
          latitude: number;
          longitude: number;
          location_label: string;
          revealed_at?: string;
        };
        Update: {
          latitude?: number;
          longitude?: number;
          location_label?: string;
          revealed_at?: string;
        };
        Relationships: [];
      };
      round_scores: {
        Row: {
          game_id: string;
          round_id: string;
          participant_id: string;
          distance_km: number | null;
          scored: boolean;
          created_at: string;
        };
        Insert: {
          game_id: string;
          round_id: string;
          participant_id: string;
          distance_km?: number | null;
          scored: boolean;
          created_at?: string;
        };
        Update: {
          distance_km?: number | null;
          scored?: boolean;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      broadcast_game_event: {
        Args: {
          p_game_id: string;
          p_event: string;
          p_payload?: Json;
        };
        Returns: undefined;
      };
      reset_game_for_replay: {
        Args: {
          p_game_id: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      game_phase: GamePhase;
    };
    CompositeTypes: Record<string, never>;
  };
}
